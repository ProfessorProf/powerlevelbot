const enums = require('./enum.js');
const settings = require('./settings.js');
const numeral = require('numeral');
const sql = require('./sql.js');
const templates = require('./templates.js');
const Discord = require("discord.js");
const moment = require("moment");
const tools = require('./tools.js');
const hour = (60 * 60 * 1000);


let endFight = async function(battle, reverse) {
    let winner = reverse ? battle.p2 : battle.p1;
    let loser = reverse ? battle.p1 : battle.p2;

    // Loser gains the Ready status, winner loses ready status if training
    if(winner.status.find(s => s.type == enums.Statuses.Training)) {
        await tools.deleteStatus(winner, enums.Statuses.Training);
    }
    
    // Determine length of KO
    let hours = Math.floor(Math.random() * 5) + 4;		// 4-8 hours
    if(loser.glory < 250) {
        hours = Math.ceil(hours * (loser.glory + 1) / 250);		// Reduce death time for low-glory players
    }
    
    // Gain glory
    const winnerLevel = tools.getPowerLevel(winner);
    const loserLevel = tools.getPowerLevel(loser);
    let glory = Math.ceil(Math.min(loserLevel / winnerLevel * 10, 100));
    glory = tools.getGlory(winner, glory);
    const rankUp = tools.rankUp(winner.glory, glory);
    winner.glory += glory;

    battle.log.push(`${winner.name} is victorious! +${glory} Glory. Total Glory: ${winner.glory}`);
    
    if(rankUp) {
        battle.log.push(`${winner.name}'s Rank has increased!`);
    }
    
    // Delete open challenges for the winner
    await sql.deleteOpenOffers(winner.id, enums.OfferTypes.Fight);

    // Delete training complete status
    await tools.deleteStatus(winner, enums.Statuses.TrainingComplete);
    await tools.deleteStatus(loser, enums.Statuses.TrainingComplete);
    
    // Death timer
    if(hours) {
        battle.log.push(`${loser.name} will be able to fight again in ${tools.getTimeString(hours * hour)}.`);
    }
    
    await tools.killPlayer(loser, hours * hour + 1);
    
    battle.p1 = reverse ? loser : winner;
    battle.p2 = reverse ? winner : loser;
    return battle;
}

let getFullAttack = function(battle, reverse) {
    let player = reverse ? battle.p2 : battle.p1;
    let attackEffects = reverse ? battle.effects2 : battle.effects1;

    let attack = tools.getAttack(player);
    let attackBoost = 0;
    let attackBoosts = attackEffects.filter(e => e.id == enums.BattleEffects.AttackBoost)
    for(const ab in attackBoosts) {
        attackBoost += attackBoosts[ab].power - 1;
    }
    attack = Math.max(0, attack * (attackBoost + 1));
    return Math.ceil(attack);
}

let getFullDefense = function(battle, reverse) {
    let player = reverse ? battle.p2 : battle.p1;
    let defenseEffects = reverse ? battle.effects1 : battle.effects2;
    
    let defense = tools.getDefense(player);
    let defenseBoost = 0;
    let defenseBoosts = defenseEffects.filter(e => e.id == enums.BattleEffects.DefenseBoost)
    for(const db in defenseBoosts) {
        defenseBoost += defenseBoosts[db].power - 1;
    }
    defense = Math.max(0, defense * (defenseBoost + 1));
    return Math.ceil(defense);
}

let attack = function(battle, reverse, multiplier) {
    let attacker = reverse ? battle.p2 : battle.p1;
    let defender = reverse ? battle.p1 : battle.p2;

    // Player 1 attack
    let attackRoll = Math.floor(Math.random() * 20) + 1;
    let damageMultiplier = 1;
    let damage = 0;
    let criticalChance = attacker.level * 1.2 < defender.level ? 3 : 2;
    if(attackRoll <= 3) {
        // Miss
        damageMultiplier = 0;
    } else if(attackRoll <= 6) {
        // Glance
        damageMultiplier = 0.25;
    } else if(attackRoll > (20 - criticalChance)) {
        damageMultiplier = 1.5;
    }
    if(multiplier > 0) {
        damageMultiplier = multiplier;
    }

    if(damageMultiplier > 0) {
        // Calculate damage
        const v = settings.DamageVariance;
        let attack = getFullAttack(battle, reverse);
        let defense = getFullDefense(battle, !reverse);

        damage = Math.max(attack * 2.5 - defense * 1.25, attack * 0.1);
        damage = Math.ceil(damage * ((1 - v) + Math.random() * (2 * v)) * damageMultiplier);
    }
    
    switch(damageMultiplier) {
        case 0:
            battle.log.push(`${attacker.name}'s attack missed!`);
            break;
        case 0.25:
            battle.log.push(`${attacker.name} hit ${defender.name}, but ${defender.config.Pronoun} blocked, only taking ${damage} damage.`);
            break;
        case 1:
            battle.log.push(`${attacker.name} hit ${defender.name} for ${damage} damage!`);
            break;
        case 1.5:
            battle.log.push(`${attacker.name} landed a critical hit on ${defender.name} for ${damage} damage!!`);
            break;
        default:
            battle.log.push(`${attacker.name} unleashed a powerful Burst Attack for ${damage} damage!`);
    }

    defender.hp = Math.max(0, defender.hp - damage);

    battle.p1 = reverse ? defender : attacker;
    battle.p2 = reverse ? attacker : defender;

    return battle;
}

let transform = function(battle, reverse) {
    let player = reverse ? battle.p2 : battle.p1;
    let tech = player.techs.find(t => t.id == enums.Techniques.Transform);
    if(!tech) return;

    let aBoost = 1 + (0.1 + 0.05 * tech.level) * (0.8 + 0.4 * Math.random());
    let dBoost = 1 + (0.1 + 0.05 * tech.level) * (0.8 + 0.4 * Math.random());
    sql.addBattleEffect(battle, enums.BattleEffects.AttackBoost, aBoost, reverse ? 2 : 1);
    sql.addBattleEffect(battle, enums.BattleEffects.DefenseBoost, dBoost, reverse ? 2 : 1);
    let attackUp = Math.ceil(tools.getAttack(player) * (aBoost - 1));
    let defenseUp = Math.ceil(tools.getDefense(player) * (dBoost - 1));

    let healAmount = Math.ceil(tools.getMaxHP(player) * (0.15 + Math.random() * 0.15));
    if(player.hp + healAmount > tools.getMaxHP(player)) {
        healAmount = Math.ceil(tools.getMaxHP(player) - player.hp);
    }

    player.hp += healAmount;

    battle.log.push(`${player.name} transformed! Recovered ${healAmount} HP! Atk +${attackUp}! Def +${defenseUp}!`);

    if(reverse) {
        battle.p2 = player;
    } else {
        battle.p1 = player;
    }
}

let rage = function(battle, reverse) {
    let player = reverse ? battle.p2 : battle.p1;
    let tech = player.techs.find(t => t.id == enums.Techniques.Rage);
    if(!tech) return;

    let boost = 1.25 + 0.1 * tech.level;
    sql.addBattleEffect(battle, enums.BattleEffects.AttackBoost, boost, reverse ? 2 : 1);
    sql.addBattleEffect(battle, enums.BattleEffects.DefenseBoost, 0.8, reverse ? 2 : 1);
    let attackUp = Math.ceil(tools.getAttack(player) * (boost - 1));
    let defenseDown = Math.ceil(tools.getDefense(player) * 0.2);

    battle.log.push(`${player.name} unleashed ${tools.their(player.config.Pronoun)} inner rage! Atk +${attackUp}! Def -${defenseDown}!`);

    if(reverse) {
        battle.p2 = player;
    } else {
        battle.p1 = player;
    }
}

let burst = function(battle, reverse) {
    let player = reverse ? battle.p2 : battle.p1;
    let tech = player.techs.find(t => t.id == enums.Techniques.BurstAttack);
    if(!tech) return;

    let modifier = 1.31 + 0.05 * tech.level;

    attack(battle, reverse, modifier);
}

let heal = function(battle, reverse) {
    let player = reverse ? battle.p2 : battle.p1;
    let tech = player.techs.find(t => t.id == enums.Techniques.Heal);
    if(!tech) return;

    let healAmount = Math.ceil(tools.getMaxHP(player) * (0.2 + Math.random() * 0.2) * (0.95 + 0.05 * tech.level));
    if(player.hp + healAmount > tools.getMaxHP(player)) {
        healAmount = Math.ceil(tools.getMaxHP(player) - player.hp);
    }

    player.hp += healAmount;

    battle.log.push(`${player.name} healed their wounds! Recovered ${healAmount} HP!`);
}

let act = function(battle, reverse) {
    let player = reverse ? battle.p2 : battle.p1;
    let overheated = false;

    if(player.intent) {
        // Overheat check
        let usedTechs = reverse ? battle.usedTechs2 : battle.usedTechs1;
        if(usedTechs.indexOf('' + player.intent) > -1) {
            // Already used, roll for overheat
            if(Math.random() < 0.7) {
                // Overheat!!
                let damage = Math.ceil(tools.getMaxHP(player) * (0.3 + 0.7 * Math.random()));
                player.hp -= damage;
                battle.log.push(`${player.name} overheated! They took ${damage} damage from the recoil.`);
                overheated = true;
            }
        } else {
            if (reverse) {
                battle.usedTechs2.push(player.intent);
            } else {
                battle.usedTechs1.push(player.intent);
            }
        }
    }

    if(!overheated) {
        switch(player.intent) {
            case enums.Techniques.Transform:
                transform(battle, reverse);
                break;
            case enums.Techniques.BurstAttack:
                burst(battle, reverse);
                break;
            case enums.Techniques.Rage:
                rage(battle, reverse);
                attack(battle, reverse);
                break;
            case enums.Techniques.Heal:
                heal(battle, reverse);
                break;
            default:
                attack(battle, reverse);
                break;
        }

        if(player.intent > 0) {
            // Train in skill
            let tech = player.techs.find(t => t.id == player.intent);
            if(tech) {
                let exp = (0.2 + Math.random() * 0.1) / tech.level;
                sql.trainTechnique(player.id, tech.id, exp);
            }
        }
    }

    player.intent = 0;

    if(reverse) {
        battle.p2 = player;
    } else {
        battle.p1 = player;
    }

    return battle;
}

module.exports = {
	async continueFight(p1, p2, message) {
        const player1Id = p1.id;
        const player2Id = p2.id;
		const taskId = setInterval(async function() {
			let oldEmbed = message.embeds[0];
			let embed = new Discord.RichEmbed();
			embed.setTitle(oldEmbed.title)
                .setColor(0xff8040);

            let oldLog = oldEmbed.fields[2].value.split('\n');

            let battle = await sql.getBattle(player1Id, player2Id);

            // Trade attacks
            battle = act(battle, false);
            battle = act(battle, true);

            // Activate effects
            for(var effect in battle.effects1) {
                effect.active = true;
            }
            for(var effect in battle.effects2) {
                effect.active = true;
            }

            // Handle ties
            if(battle.p1.hp <= 0 && battle.p2.hp <= 0) {
                if(Math.random() < 0.5) {
                    battle.log.push(`Both fighters fall... but ${battle.p1.name} rises to ${tools.their(battle.p1.config.pronoun)} feet!`);
                    battle.p1.hp = 1;
                } else {
                    battle.log.push(`Both fighters fall... but ${battle.p2.name} rises to ${tools.their(battle.p2.config.pronoun)} feet!`);
                    battle.p2.hp = 1;
                }
            }

            if(battle.p2.hp == 0) {
                // Player 1 victory
                battle = await endFight(battle, false);
            } else if(battle.p1.hp == 0) {
                // Player 2 victory
                battle = await endFight(battle, true);
            }

            // Truncate old log messages
			if(battle.log.length > 6) {
				battle.log = battle.log.slice(battleLog.length - 6);
			} else if(battle.log.length + oldLog.length > 6) {
                battle.log = oldLog.slice(oldLog.length - (6 - battle.log.length)).concat(battle.log);
            } else {
                battle.log = oldLog.concat(battle.log);
            }

            let level1 = numeral(tools.getPowerLevel(battle.p1).toPrecision(2)).format('0,0');
            let level2 = numeral(tools.getPowerLevel(battle.p2).toPrecision(2)).format('0,0');
            embed.addField(battle.p1.name, `PL ${level1}` +
                `\nA ${getFullAttack(battle, false)} D ${getFullDefense(battle, false)}` +
                `\nHP **${Math.ceil(battle.p1.hp)}/${tools.getMaxHP(battle.p1)}**`, true);
            embed.addField(battle.p2.name, `PL ${level2}` +
                `\nA ${getFullAttack(battle, true)} D ${getFullDefense(battle, true)}` +
                `\nHP **${Math.ceil(battle.p2.hp)}/${tools.getMaxHP(battle.p2)}**`, true);
			embed.addField('Battle Log', battle.log.join('\n'));
			message.edit(embed);

            await sql.setPlayer(battle.p1);
            await sql.setPlayer(battle.p2);
			if(battle.p1.hp == 0 || battle.p2.hp == 0) {
                await sql.endBattle(battle.id);
				clearInterval(taskId);
			} else {
                await sql.setBattle(battle);
            }
		}, 5000);
    }
}