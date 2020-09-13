const enums = require('./enum.js');
const settings = require('./settings.js');
const numeral = require('numeral');
const sql = require('./sql.js');
const templates = require('./templates.js');
const Discord = require("discord.js");
const moment = require("moment");
const { setPlayer } = require('./sql.js');
const hour = (60 * 60 * 1000);

module.exports = {
	// Gets an Embed showing a player's status.
	async getPlayerDescription(player, username, private) {
		return this.generatePlayerDescription(player, username, private);
	},
	async getPlayerDescriptionById(id, username) {
		return this.generatePlayerDescription(await sql.getPlayerById(id), username);
	},
	async generatePlayerDescription(player, username, private) {
		if(!player) {
			console.log('Player not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		const now = new Date().getTime();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0x00AE86);
		
			if(player.npc) {
			embed.setDescription('MONSTER');
		}
		
		let stats = '';
		if(!player.npc) {
			// Display Glory/Rank
			stats += `${player.glory} Glory\n`;
			let glory = player.glory;
			if(this.isFusion(player)) glory = Math.floor(glory / 2);
			if(glory < 50) {
				stats += 'Unranked Warrior\n';
			} else if(glory < 100) {
				stats += 'Rank C Warrior\n';
			} else if(glory < 150) {
				stats += 'Rank B Warrior\n';
			} else if(glory < 250) {
				stats += 'Rank A Warrior\n';
			} else if(glory < 400) {
				stats += 'Rank S Warrior\n';
			} else if(glory < 700) {
				stats += 'Rank S+ Warrior\n';
			} else if(glory < 1000) {
				stats += 'Rank S++ Warrior\n';
			} else {
				stats += 'Ultimate Warrior\n';
			}
		}
		
		stats += 'Power Level: '
		const level = this.getPowerLevel(player);
		stats += numeral(level.toPrecision(2)).format('0,0');
		if(player.status.find(s => s.type == enums.Statuses.Training)) {
			stats += '?';
		}

		stats += `\nHealth: ${Math.ceil(player.hp)}/${this.getMaxHP(player)}`;
		stats += `\nAttack: ${this.getAttack(player)}`;
		stats += `\nDefense: ${this.getDefense(player)}`;
		
		embed.addField('Stats', stats);

		// Display Techniques
		let techs = player.techs.map(t => { 
			return `${enums.Techniques.Name[t.id]} (Level ${Math.floor(t.level)}, `
				+ `${Math.ceil((t.level - Math.floor(t.level)) * 100)}% EXP)`
		}).join('\n');
		if(techs) {
			embed.addField('Techniques', techs);
		}

		// Display Status
		let statuses = [];
		let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
		for(const i in player.status) {
			const s = player.status[i];
			if(!s.ends || s.endTime > now) {
				switch(s.type) {
					case enums.Statuses.Dead:
						statuses.push(`Defeated (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Journey:
						statuses.push(`On a journey (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Training:
						statuses.push(`Training (${this.getTimeString(now - s.startTime)} so far)`);
						break;
					case enums.Statuses.Energized:
						statuses.push(`Energized (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Transform:
						statuses.push(`Transformed (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.SuperTransform:
						statuses.push(`Super Form (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.UltimateForm:
						statuses.push(`Ultimate Form (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Ready:
						if(!defeated)
							statuses.push(`Ready to train`);
						break;
					case enums.Statuses.Carrot:
						statuses.push(`Enhanced senses (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Bean:
						statuses.push(`Power boosted (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Fern:
						statuses.push(`Power level hidden (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Fused:
						statuses.push(`Fused (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.PowerWish:
						statuses.push(`Blessed with power`);
						break;
					case enums.Statuses.Immortal:
						if(s.endTime) {
							statuses.push(`Immortal (${this.getTimeString(s.endTime - now)} remaining)`);
						} else {
							statuses.push(`Immortal`);
						}
						break;
					case enums.Statuses.Berserk:
						statuses.push(`Berserk (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Annihilation:
						statuses.push(`Annihilated`);
						break;
					case enums.Statuses.Guarded:
						const guardingPlayer = await sql.getPlayerById(s.rating);
						statuses.push(`Protected by ${guardingPlayer.name} (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
				}
			}
		}
		if(statuses.length > 0) {
			embed.addField('Status', statuses.join('\n'));
		}
		const cooldowns = player.cooldowns.filter(c => enums.Cooldowns.Name[c.type]).map(c => {
			return `${enums.Cooldowns.Name[c.type]}: Ready in ${this.getTimeString(c.endTime - now)}`
		});
		if(cooldowns.length > 0) {
			embed.addField('Cooldowns', cooldowns.join('\n'));
		}

		// Display Offers
		let offers = [];
		for(const i in player.offers) {
			const o = player.offers[i];
			if(o.expires > now) {
				switch(o.type) {
					case enums.OfferTypes.Fight:
						offers.push(`${o.name} wants to \`!fight\` ${o.targetId ? 'you' : 'anyone'} (expires in ${this.getTimeString(o.expires - now)})`);
						break;
					case enums.OfferTypes.Fusion:
						offers.push(`${o.name} wants to \`!fuse\` with you (expires in ${this.getTimeString(o.expires - now)})`);
						break;
					case enums.OfferTypes.Recruit:
						if(o.targetId) {
							offers.push(`${o.name} wants you to \`!join\` them (expires in ${this.getTimeString(o.expires - now)})`);
						} else {
							offers.push(`${o.name} wants someone to \`!join\` them (expires in ${this.getTimeString(o.expires - now)})`);
						}
						break;
					case enums.OfferTypes.Taunt:
						offers.push(`${o.name} taunted you to \`!fight\` them (expires in ${this.getTimeString(o.expires - now)})`);
						break;
				}
			}
		}
		if(offers.length > 0) {
			embed.addField('Offers', offers.join('\n'));
		}
		
		return embed;
	},
	// Give advanced data about a player
	async getPlayerDeepDescription(player) {
		if(!player) {
			console.log('Player not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		const now = new Date().getTime();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0x00AE86);

		let stats = '';
		if(player.legacyGlory > 0) {
			// Display Legacy Glory
			const legacyBonus = Math.floor(Math.sqrt(player.legacyGlory / 750) * 100);
			stats += `\nYou have ${Math.floor(player.legacyGlory)} Legacy Glory, granting you +${legacyBonus}% to all Glory gains (rounded down).`;
		}
		
		const history = await sql.getHistory(player.id);
		const losses = history.filter(h => h.loserId == player.id).length;

		if(losses == 1) {
			stats += `\nYou have fallen in battle once, granting you a 5% bonus to training gains.`;
		} else if(losses == 2) {
			stats += `\nYou have fallen in battle twice, granting you a 10% bonus to training gains.`;
		} else if(losses > 2) {
			stats += `\nYou have fallen in battle ${losses} times, granting you a ${losses * 5}% bonus to training gains.`;
		}

		if(stats == '') {
			stats += 'You have no special traits yet.'
		}

		embed.addField('Stats', stats);

		const cooldowns = player.cooldowns.map(c => {return null}).filter(c => c);
		if(cooldowns.length > 0) {
			embed.addField('Cooldowns', cooldowns.join('\n'));
		}

		return embed;
	},
	// Scout a player's estimated power level and status.
    async scoutPlayer(player) {
		if(!player) {
			console.log('Player not found');
			return null;
		}
		const now = new Date().getTime();
		let embed = new Discord.RichEmbed();
		embed.setTitle(`SCANNING ${player.name.toUpperCase()}...`)
			.setColor(0x00AE86);
		
		stats = 'Power Level: '
		const training = player.status.find(s => s.type == enums.Statuses.Training);
		const trainingTime = now - (training ? training.startTime : 0);
		if(player.status.find(s => s.type == enums.Statuses.Fern)) {
			stats += 'Unknown';
		} else {
			let seenLevel = this.getPowerLevel(player);
			if(training) {
				// Estimate post-training power level
				const world = await sql.getWorld(player.channel);
				let hours = trainingTime / hour;
				if (hours > 72) {
					hours = 72;
				}
				let newPowerLevel = Math.pow(150, 1 + (world.heat + hours) / 1000);
				if (this.isFusion(player)) {
					newPowerLevel *= 1.3;
				}
				if (player.status.find(s => s.type == enums.Statuses.PowerWish)) {
					newPowerLevel *= 1.5;
				}
				if (hours <= 16) {
					seenLevel += newPowerLevel * (hours / 16);
				} else {
					seenLevel += newPowerLevel * (1 + 0.01 * (hours / 16));
				}
			}
			const level = numeral(seenLevel.toPrecision(2));
			stats += level.format('0,0');
		}
		if(training) {
			stats += `\nTraining for ${this.getTimeString(trainingTime)}`;
		}
		embed.addField('Stats', stats);

		return embed;
    },
	// Converts a time in milliseconds into a readable string.
    getTimeString(milliseconds) {
        let seconds = Math.ceil(milliseconds / 1000);
        let minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        let hours = Math.floor(minutes / 60);
        minutes -= hours * 60;
        let days = Math.floor(hours / 24);
        hours -= days * 24;
        
        let output = '';
        if(days) {
            output += days + (days > 1 ? ' days' : ' day');
        }
        if(hours) {
            if(output) {
                output += ((seconds || minutes) ? ', ' : ' and ');
            }
            output += hours + (hours > 1 ? ' hours' : ' hour');
        }
        if(minutes) {
            if(output) {
                output += (seconds ? ', ' : ' and ');
            }
            output += minutes + (minutes > 1 ? ' minutes' : ' minute');
        }
        if(seconds) {
            if(output) output += ' and ';
            output += seconds + (seconds > 1 ? ' seconds' : ' second');
        }
        
        return output;
	},
	// Creates a table displaying the name, rank, status and power level of all active players.
    async displayRoster(channel) {
		let players = await sql.getPlayers(channel);
		const now = new Date().getTime();
		
		// Build the table out in advance so we can get column widths
		let headers = [4, 4, 6, 11];
		let rows = [];
		for(const i in players) {
			let p = players[i];
			if (this.isFusionPart(p)) {
				continue;
			}
			if(p.lastActive + 24 * hour < now) {
				continue;
			}
			if(p.status.find(s => s.type == enums.Statuses.Annihilation)) {
				continue;
			}

			let row = [];
			row.push(p.name);
			if(p.name.length > headers[0]) headers[0] = p.name.length;
			
			let rank = '-';
			let glory = p.glory;
			if(this.isFusion(p)) glory /= 2;
			if(glory >= 1000) {
				rank = 'U';
			} else if(glory >= 700) {
				rank = 'S++';
			} else if(glory >= 400) {
				rank = 'S+';
			} else if(glory >= 250) {
				rank = 'S';
			} else if(glory >= 150) {
				rank = 'A';
			} else if(glory >= 100) {
				rank = 'B';
			} else if(glory >= 50) {
				rank = 'C';
			}
			row.push(rank);
			
			p.status.sort((a,b) => b.priority - a.priority);
			const statuses = p.status.filter(s => s.priority > 0);
			
			const status = statuses.length > 0 ? statuses[0].name : 'Normal';
			
			row.push(status);
			if(status.length > headers[2]) headers[2] = status.length;
			
			let seenLevel = this.getPowerLevel(p);
			let level = numeral(seenLevel.toPrecision(2)).format('0,0');
			
			if(p.status.find(s => s.type == enums.Statuses.Fern)) {
				level = 'Unknown'
			} else if(p.status.find(s => s.type == enums.Statuses.Training)) {
				level += '?'
			}
			
			row.push(level);
			if(level.length > headers[3]) headers[3] = level.length;
			
			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'NAME' + ' '.repeat(headers[0] - 3);
		output += 'RANK' + ' '.repeat(headers[1] - 3);
		output += 'STATUS' + ' '.repeat(headers[2] - 5);
		output += 'POWER LEVEL' + ' '.repeat(headers[3] - 10);
		output += '\n';
		output += '-'.repeat(headers[0]) + ' ';
		output += '-'.repeat(headers[1]) + ' ';
		output += '-'.repeat(headers[2]) + ' ';
		output += '-'.repeat(headers[3]) + ' ';
		output += '\n';
		
		for(const i in rows) {
			let row = rows[i];
			output += row[0].padEnd(headers[0] + 1);
			output += row[1].padEnd(headers[1] + 1);
			output += row[2].padEnd(headers[2] + 1);
			output += row[3].padEnd(headers[3] + 1);
			output += '\n';
			if(output.length > 1950) {
				output += '...\n';
				break;
			}
		}
		
		return `\`\`\`\n${output}\`\`\``;
	},
	// Creates a table displaying the high scores at the end of a game.
    async displayScores(channel) {
		let players = await sql.getPlayers(channel, true);
		
		// Build the table out in advance so we can get column widths
		let headers = [5, 4, 5];
		let place = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
		let rows = [];
		players.sort((a,b) => b.glory - a.glory);
		if(players.length > 10) {
			players = players.slice(0, 10);
		}
		for(const i in players) {
			let p = players[i];
			if (this.isFusionPart(p)) {
				continue;
			}

			let row = [];
			row.push(place[i]);
			row.push(p.name);
			let glory = p.glory.toString();
			row.push(glory);
			if(p.name.length > headers[1]) headers[1] = p.name.length;
			if(glory.length > headers[2]) headers[2] = glory.length;

			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'PLACE' + ' '.repeat(headers[0] - 5);
		output += 'NAME' + ' '.repeat(headers[1] - 3);
		output += 'GLORY' + ' '.repeat(headers[2] - 5);
		output += '\n';
		output += '-'.repeat(headers[0]) + ' ';
		output += '-'.repeat(headers[1]) + ' ';
		output += '-'.repeat(headers[2]) + ' ';
		output += '\n';
		
		for(const i in rows) {
			let row = rows[i];
			output += row[0].padEnd(headers[0] + 1);
			output += row[1].padEnd(headers[1] + 1);
			output += row[2].padEnd(headers[2] + 1);
			output += '\n';
		}
		
		return `\`\`\`\n${output}\`\`\``;
	},
	async unfight(player) {
		await sql.unfightOffers(player.id);
		return `${player.name} no longer wants to fight anyone.`;
	},
	async taunt(player1, player2) {
		// Stub
		return null;
	},
	// Either fights a player or sends them a challenge, depending on whether or not they've issued a challenge.
    async tryFight(player1, player2) {
		let output = [];
		let embed = new Discord.RichEmbed();
		
		if(player2) {
			const offer = player1.offers.find(o => o.playerId == player2.id && 
				(o.type == enums.OfferTypes.Fight || o.type == enums.OfferTypes.Taunt));
			if(!offer) {
				await sql.addStatus(player1.channel, player1.id, enums.Statuses.Cooldown, 30 * 1000, enums.Cooldowns.Challenge);
			}
			if(!offer) {
				// If they haven't offered, send a challenge
				embed.setTitle('BATTLE CHALLENGE')
					.setColor(0xff8040)
					.setDescription(`**${player1.name}** has issued a battle challenge to **${player2.name}**! ` +
						`${player2.name}, enter \`!fight ${player1.name}\` to accept the challenge and begin the battle.`);
				await sql.addOffer(player1, player2, enums.OfferTypes.Fight);
				output.push(embed);
			} else {
				// FIGHT
				embed.setTitle(`${player1.name.toUpperCase()} vs ${player2.name.toUpperCase()}`)
						.setColor(0xff8040);
				output = await this.fight(player1, player2, embed);
			}
			if(player2.config.Ping) {
				output.push(await this.getPings(player2));
			}
		} else {
			await sql.addOffer(player1, null, enums.OfferTypes.Fight);
			embed.setTitle('BATTLE CHALLENGE')
				.setColor(0xff8040)
				.setDescription(`**${player1.name}** wants to fight anyone! The next person to enter \`!fight ${player1.name}\` will accept the challenge and begin the battle.`);
			output.push(embed);
			await sql.addStatus(player1.channel, player1.id, enums.Statuses.Cooldown, 60 * 1000, enums.Cooldowns.Challenge);
		}
		return output;
	},
	// End training and power up a player. Will do nothing if player is not training.
	async completeTraining(player, forcedValue) {
		let world = await sql.getWorld(player.channel);
		const now = new Date().getTime();

		const trainingState = player.status.find(s => s.type == enums.Statuses.Training);
		if (!trainingState && !forcedValue) {
			// Not training, so no need to do anything
			return null;
		}

		let embed = new Discord.RichEmbed()
			.setTitle(`Training Complete`);

		const oldMaxHp = this.getMaxHP(player);
		const oldAtk = this.getAttack(player);
		const oldDef = this.getDefense(player);

		await this.deleteStatus(player, enums.Statuses.Journey);
		await this.deleteStatus(player, enums.Statuses.Training);
		await sql.addStatus(player.channel, player.id, enums.Statuses.TrainingComplete);
		player.status.push({
			type: enums.Statuses.TrainingComplete
		});

		const history = await sql.getHistory(player.id);
		const losses = history.filter(h => h.loserId == player.id).length;

		const time = forcedValue ? forcedValue : (now - trainingState.startTime);
		let hours = time / hour;
		if (hours > 72) {
			hours = 72;
		}
		this.addHeat(world, hours);
		let newPowerLevel = this.newPowerLevel(world.heat);
		newPowerLevel *= 1 + 0.05 * losses;
		console.log(`${player.name} power +${5 * losses}% due to defeats`);
		if (this.isFusion(player)) {
			newPowerLevel *= 1.3;
		}
		if (player.status.find(s => s.type == enums.Statuses.PowerWish)) {
			newPowerLevel *= 1.5;
		}
		console.log(`Upgrading ${player.name}'s power level after ${hours} hours of training, +${newPowerLevel}`);
		if (hours <= 16) {
			player.level += newPowerLevel * (hours / 16);
		} else {
			player.level += newPowerLevel * (1 + 0.01 * (hours / 16));
		}

		// Adjust stat balance
		switch(trainingState.rating) {
			case enums.TrainingTypes.Neutral:
				player.hAdjust += 0.01 * Math.min(hours, 12);
				player.aAdjust += 0.01 * Math.min(hours, 12);
				player.dAdjust += 0.01 * Math.min(hours, 12);
				break;
			case enums.TrainingTypes.Attack:
				player.aAdjust += 0.02 * Math.min(hours, 12);
				break;
			case enums.TrainingTypes.Defense:
				player.dAdjust += 0.02 * Math.min(hours, 12);
				break;
			case enums.TrainingTypes.Health:
				player.hAdjust += 0.02 * Math.min(hours, 12);
				break;
		}

		const totalAdjust = (player.hAdjust + player.aAdjust + player.dAdjust) / 3;
		player.hAdjust /= totalAdjust;
		player.aAdjust /= totalAdjust;
		player.dAdjust /= totalAdjust;

		const newMaxHp = this.getMaxHP(player);
		const newAtk = this.getAttack(player);
		const newDef = this.getDefense(player);

		message = `${player.name} completed ${this.their(player.config.Pronoun)} training!`;
		if(oldMaxHp != newMaxHp) {
			message += `\nMaximum Health ${oldMaxHp > newMaxHp ? 'decreased' : 'increased'} from ${oldMaxHp} to ${newMaxHp}!`;
		}
		if(oldAtk != newAtk) {
			message += `\nAttack ${oldAtk > newAtk ? 'decreased' : 'increased'} from ${oldAtk} to ${newAtk}!`;
		}
		if(oldDef != newDef) {
			message += `\nDefense ${oldDef > newDef ? 'decreased' : 'increased'} from ${oldDef} to ${newDef}!`;
		}

		// Learn techniques
		let learnChance = Math.min(0.5, (Math.min(hours, 16) / 32) / (player.techs.length + 1));
		if(Math.random() < learnChance) {
			let techList = Object.values(enums.Techniques)
				.filter(t => !player.techs.find(tt => tt.id == t.id));
			techList = techList.slice(0, techList.length - 2);
			if(techList.length > 0) {
				let techId = techList[Math.floor(Math.random() * techList.length)];
				message += `\nLearned the technique "${enums.Techniques.Name[techId]}"!`
					+ ` In battle, use the command ${enums.Techniques.Command} to use it.`;
				await sql.addTechnique(player, techId);
			}
		}

		embed.setDescription(message);

		// Heal by gained max HP
		player.hp = Math.min(player.hp + (newMaxHp - oldMaxHp), newMaxHp);

		await sql.setPlayer(player);
		await sql.setWorld(world);

		return embed;
	},
	// Fight between two players.
    async fight(player1, player2, embed) {
		let output = [];
		let channel = player1.channel;	
		let world = await sql.getWorld(channel);

		embed.setTitle(`EPISODE ${world.episode}: ${embed.title}`);

		// If fighters are training - take them out of training and power them up
		let trainingEmbed1 = await this.completeTraining(player1);
		let trainingEmbed2 = await this.completeTraining(player2);
		if(trainingEmbed1) output.push(trainingEmbed1);
		if(trainingEmbed2) output.push(trainingEmbed2);

		let level1 = numeral(this.getPowerLevel(player1).toPrecision(2)).format('0,0');
		let level2 = numeral(this.getPowerLevel(player2).toPrecision(2)).format('0,0');
		embed.addField(player1.name, `PL ${level1}` +
			`\nA ${this.getAttack(player1)} D ${this.getDefense(player1)}` +
			`\nHP **${Math.ceil(player1.hp)}/${this.getMaxHP(player1)}**`, true);
		embed.addField(player2.name, `PL ${level2}` + 
			`\nA ${this.getAttack(player2)} D ${this.getDefense(player2)}` +
			`\nHP **${Math.ceil(player2.hp)}/${this.getMaxHP(player2)}**`, true);
		embed.addField('Battle Log', `Prepare to battle!`);

		output.push(embed);

		await sql.setIntent(player1, 0);
		await sql.setIntent(player2, 0);
		await sql.newBattle(player1, player2);
		return output;
	},
	// Process updates based on who won and lost a fight.
	async handleFightOutcome(data, winner, loser, winnerSkill, loserSkill, taunted) {
		const now = new Date().getTime();
		const world = await sql.getWorld(winner.channel);
		let output = '';
		
		// Loser gains the Ready status, winner loses ready status if training
		if(winner.status.find(s => s.type == enums.Statuses.Training)) {
			await this.deleteStatus(winner, enums.Statuses.Training);
		}
		
		// Determine length of KO
		const difference = winnerSkill - loserSkill + 1; 		// Effective 0-2 (barring skill modifiers)
		const intensity = Math.max(winnerSkill, loserSkill);	// Effective 0-2
		let hours = Math.ceil(difference * intensity * 3);		// Effective 0-12
		hours = Math.max(Math.min(hours, 12), 1);				// Cap it at range 1-12 for now
		if(loser.glory < 250) {
			hours = Math.ceil(hours * loser.glory / 250);		// Reduce death time for low-glory players
		}
		
		let trueForm = false;
		const winnerLevel = this.getPowerLevel(winner);
		const loserLevel = this.getPowerLevel(loser);
		let template = winnerLevel > loserLevel ? enums.FightSummaries.ExpectedWin : enums.FightSummaries.UnexpectedWin;

		let glory = Math.ceil(Math.min(loserLevel / winnerLevel * 10, 100));

		// Award glory to the winner
		glory = this.getGlory(winner, glory);

		const rankUp = this.rankUp(winner.glory, glory);
		winner.glory += glory;
		if(trueForm) {
			output += `${winner.name} gains ${glory} Glory. Total Glory: ${winner.glory}`;
		} else {
			output += `${winner.name} is the winner! +${glory} Glory. Total Glory: ${winner.glory}`;
		}
		if(rankUp) {
			output += `\n${winner.name}'s Rank has increased!`;
		}

		// If the fight is in response to a taunt, and the taunter lost, reduce their Glory
		if(taunted) {
			const gloryPenalty = Math.ceil(Math.min(glory / 2, loser.glory));
			loser.glory -= gloryPenalty;
			output += `\n${loser.name} loses ${gloryPenalty} Glory.`
		}
		
		// Delete open challenges for the winner
		await sql.deleteOpenOffers(winner.id, enums.OfferTypes.Fight);

		// Delete training complete status
		await this.deleteStatus(winner, enums.Statuses.TrainingComplete);
		await this.deleteStatus(loser, enums.Statuses.TrainingComplete);
		
		// Add new row to history
		await sql.addHistory(winner.channel, winner.id, winnerLevel, winnerSkill, loser.id, loserLevel, loserSkill);
		
		if(loser.npc) {
			output += `\n${loser.name} is slain, its body disintegrating in the wind!`;
		} else {
			// Death timer
			if(hours) {
				output += `\n${loser.name} will be able to fight again in ${this.getTimeString(hours * hour)}.`;
			}
		}

		// Reset fight clock
		loser.lastFought = now;
		winner.lastFought = now;

		// Log an episode
		let templateList;
		switch(template) {
			case enums.FightSummaries.ExpectedWin:
				templateList = templates.FightTemplatesExpected;
				break;
			case enums.FightSummaries.UnexpectedWin:
				templateList = templates.FightTemplatesUnexpected;
				break;
		}
		let summary = templateList[Math.floor(Math.random() * templateList.length)];
		summary = summary.replace(new RegExp('\\$winner', 'g'), winner.name)
			.replace(new RegExp('\\$loser', 'g'), loser.name)
			.replace(new RegExp('\\$wTheir', 'g'), this.their(winner.config.pronoun))
			.replace(new RegExp('\\$lTheir', 'g'), this.their(loser.config.pronoun));
		await sql.addEpisode(winner.channel, summary);

		// Save changes
		await this.killPlayer(loser, hours * hour + 1);
		await sql.setPlayer(loser);
		await sql.setPlayer(winner);
		
		return output;
	},
	// Determines whether or not a glory increase resulted in a rank increase.
	rankUp(glory, gloryIncrease) {
		return (glory < 50 && glory + gloryIncrease >= 50) ||
			   (glory < 100 && glory + gloryIncrease >= 100) ||
			   (glory < 150 && glory + gloryIncrease >= 150) ||
			   (glory < 250 && glory + gloryIncrease >= 250) ||
			   (glory < 400 && glory + gloryIncrease >= 400) ||
			   (glory < 700 && glory + gloryIncrease >= 700) ||
			   (glory < 1000 && glory + gloryIncrease >= 1000);
	},
	// Attempt to create a new Fusion.
    async fuse(sourcePlayer, targetPlayer, fusionName) {
		const channel = sourcePlayer.channel;
		const now = new Date().getTime();
		const world = await sql.getWorld(channel);
		let output = [];

		// Check to see if we're accepting an offer
		let fusionOffer = sourcePlayer.offers.find(o => o.type == 1 && o.playerId == targetPlayer.id && fusionName == o.extra);
		if(fusionOffer) {
			await this.completeTraining(sourcePlayer);
			await this.completeTraining(targetPlayer);
			this.addHeat(world, 100);
			const name = fusionName;
			const fusedPlayer = {
				name: name,
				channel: channel,
				level: Math.max(sourcePlayer.level, targetPlayer.level) + this.newPowerLevel(world.heat),
				powerWish: sourcePlayer.powerWish || targetPlayer.powerWish,
				glory: sourcePlayer.glory + targetPlayer.glory,
				lastActive: now,
				lastFought: Math.max(sourcePlayer.lastFought, targetPlayer.lastFought),
				trainingDate: now,
				actionLevel: Math.max(sourcePlayer.actionLevel, targetPlayer.actionLevel),
				gardenLevel: Math.max(sourcePlayer.gardenLevel, targetPlayer.gardenLevel),
				config: {
					alwaysPrivate: sourcePlayer.config.alwaysPrivate && targetPlayer.config.alwaysPrivate,
					ping: sourcePlayer.config.ping && targetPlayer.config.ping,
					AutoTrain: sourcePlayer.config.AutoTrain && targetPlayer.config.AutoTrain,
					pronoun: sourcePlayer.config.Pronoun == targetPlayer.config.Pronoun ? sourcePlayer.config.Pronoun : 'they'
				}
			};
			const fusionId = await sql.addPlayer(fusedPlayer);
			fusedPlayer.id = fusionId;
			await sql.setFusionId(fusionId, fusionId);
			await sql.setFusionId(sourcePlayer.id, fusionId);
			await sql.setFusionId(targetPlayer.id, fusionId);
			await sql.deleteAllFusionOffers(sourcePlayer.id);
			await sql.deleteAllFusionOffers(targetPlayer.id);
			await sql.addStatus(channel, fusionId, enums.Statuses.Fused, 24 * hour);
			await sql.addStatus(channel, sourcePlayer.id, enums.Statuses.Cooldown, 7 * 24 * hour, enums.Cooldowns.FusionUsed);
			await sql.addStatus(channel, targetPlayer.id, enums.Statuses.Cooldown, 7 * 24 * hour, enums.Cooldowns.FusionUsed);
			for (const item of sourcePlayer.items) {
				await sql.addItems(channel, fusionId, item.type, item.count);
				await sql.addItems(channel, sourcePlayer.id, item.type, -item.count);
			}
			for (const item of targetPlayer.items) {
				if(item.type != enums.Items.Trophy) {
					await sql.addItems(channel, fusionId, item.type, item.count);
					await sql.addItems(channel, targetPlayer.id, item.type, -item.count);
				}
			}
			for(const status of sourcePlayer.status) {
				if(enums.Statuses.CopyToFusion[status.type]) {
					if(status.endTime) {
						await this.deleteStatusById(sourcePlayer, status.id);
					}
					await sql.addStatus(channel, fusionId, status.type, status.endTime ? (status.endTime - now) : null, status.rating);
				}
			}
			for(const status of targetPlayer.status) {
				if(enums.Statuses.CopyToFusion[status.type]) {
					if(status.endTime) {
						await this.deleteStatusById(targetPlayer, status.id);
					}
					await sql.addStatus(channel, fusionId, status.type, status.endTime ? (status.endTime - now) : null, status.endTime - now, status.rating);
				}
			}
			await sql.deleteOffersForPlayer(sourcePlayer.id);
			await sql.deleteOffersForPlayer(targetPlayer.id);
			console.log(`Created fusion of ${sourcePlayer.name} and ${targetPlayer.name} as ${name}`);
			
			return [`**${sourcePlayer.name}** and **${targetPlayer.name}** pulsate with a strange power as they perform an elaborate dance. Suddenly, there is a flash of light!`,
				await this.getPlayerDescriptionById(fusionId, sourcePlayer.username)];
		}

		// Send an offer to the other player
		const expiration = now + hour * 6;
		const fuseCommand = `!fuse ${sourcePlayer.name}` + (fusionName ? ' ' + fusionName : '');
		sql.addOffer(sourcePlayer, targetPlayer, enums.OfferTypes.Fusion, fusionName);
		console.log(`'New fusion offer from ${sourcePlayer.name} for player ${targetPlayer.name} expires at ${new Date(expiration)}`);
		
		let embed = new Discord.RichEmbed();
		embed.setTitle('FUSION OFFER')
			.setColor(0x8080ff)
			.setDescription(`**${sourcePlayer.name}** wants to fuse with **${targetPlayer.name}**! ${targetPlayer.name}, enter \`${fuseCommand}\` to accept the offer and fuse.\n` +
			'Fusion lasts 24 hours before you split again.\n' + 
			'The offer will expire in six hours.');
		const message = targetPlayer.config.Ping ? await this.getPings(targetPlayer) : null;
		output.push(embed);
		if(message) output.push(message);
		return output;
	},
	async breakFusion(channel, fusionId, playerId1, playerId2, pings, messages) {
		const fusionPlayer = await sql.getPlayerById(fusionId);
		const fusedPlayer1 = await sql.getPlayerById(playerId1);
		const fusedPlayer2 = await sql.getPlayerById(playerId2);
		const now = new Date().getTime();
		if(!fusionPlayer || !fusedPlayer1 || !fusedPlayer2) return;

		// Divvy up skill and glory gains
		const preGarden = Math.max(fusedPlayer1.gardenLevel, fusedPlayer2.gardenLevel);
		const gardenDiff = (fusionPlayer.gardenLevel - preGarden) / 2;
		fusedPlayer1.gardenLevel += gardenDiff;
		fusedPlayer2.gardenLevel += gardenDiff;

		const preAction = Math.max(fusedPlayer1.actionLevel, fusedPlayer2.actionLevel);
		const actionDiff = (fusionPlayer.actionLevel - preAction) / 2;
		fusedPlayer1.actionLevel += actionDiff;
		fusedPlayer2.actionLevel += actionDiff;

		fusedPlayer1.level = fusionPlayer.level / 2;
		fusedPlayer2.level = fusionPlayer.level / 2;

		const preGlory = fusedPlayer1.glory + fusedPlayer2.glory;
		const gloryDiff = Math.floor((fusionPlayer.glory - preGlory) / 2);
		fusedPlayer1.glory += gloryDiff;
		fusedPlayer2.glory += gloryDiff;

		fusedPlayer1.lastActive = fusionPlayer.lastActive;
		fusedPlayer2.lastActive = fusionPlayer.lastActive;
		fusedPlayer1.lastFought = fusionPlayer.lastFought;
		fusedPlayer2.lastFought = fusionPlayer.lastFought;

		await sql.setPlayer(fusedPlayer1);
		await sql.setPlayer(fusedPlayer2);

		// Roll for items like this is some kind of old-school MMO raid
		for (const item of fusionPlayer.items) {
			for (let i = 0; i < item.count; i++) {
				if (Math.random() >= 0.5) {
					await sql.addItems(channel, fusedPlayer1.id, item.type, 1);
				} else {
					await sql.addItems(channel, fusedPlayer2.id, item.type, 1);
				}
			}
		}

		// Unfuse
		await sql.setFusionId(fusedPlayer1.id, 0);
		await sql.setFusionId(fusedPlayer2.id, 0);

		// Update last active values for the players
		fusedPlayer1.lastActive = fusionPlayer.lastActive;
		fusedPlayer2.lastActive = fusionPlayer.lastActive;
		fusedPlayer1.lastFought = fusionPlayer.lastFought;
		fusedPlayer2.lastFought = fusionPlayer.lastFought;

		// Delete offers
		for(const offer of fusionPlayer.offers) {
			await sql.deleteOffer(offer.playerId, offer.targetId, offer.type);
		}

		// Split up statuses
		for(const status of fusionPlayer.status) {
			if(status.type != enums.Statuses.Fused) {
				if(status.endTime) {
					await sql.addStatus(channel, fusedPlayer1.id, status.type, (status.endTime - now) / 2, status.rating);
					await sql.addStatus(channel, fusedPlayer2.id, status.type, (status.endTime - now) / 2, status.rating);
				}
				await this.deleteStatusById(fusionPlayer, status.id);
			}
		}

		// Clean up the fusion player
		await sql.deletePlayer(fusionPlayer.id);

		if(messages) {
			messages.push(`**${fusionPlayer.name}** disappears in a flash of light, leaving two warriors behind.`);
		}

		if(pings && fusedPlayer1.config.Ping) {
			pings.push(await this.getPings(fusedPlayer1));
		}
		if(pings && fusedPlayer2.config.Ping) {
			pings.push(await this.getPings(fusedPlayer2));
		}
	},
	// Check whether or not a player is a fusion.
    isFusion(player) {
        return player && player.fusedPlayers && player.fusedPlayers.length == 2;
	},
	// Check whether or not a player is a part of a fusion.
    isFusionPart(player) {
        return player && player.fusedPlayers.length == 0 && player.fusionId;
	},
	// Generates a new power level based on the current Heat.
    newPowerLevel(heat) {
		let level = Math.pow(150, 1 + heat / 1000) * (1 + Math.random() * settings.PowerVariation);
        if(level > 1000000000000000000) level = 1000000000000000000; // JS craps out if we go higher than this
        return level;
	},
	// Increase Heat, modified by reset count.
    addHeat(world, heat) {
		if(!world) return;
		const multiplier = 10 / Math.max(10, world.population) * settings.HeatMultiplier;
        const addedHeat = heat * (1 + 0.05 * world.resets) * multiplier;
        world.heat += addedHeat;
        console.log(`Heat increased by ${heat} to ${world.heat}`);
	},
	// Reset the universe.
	async resetData(channel) {
		const now = new Date().getTime();
		await sql.resetWorld(channel);
		let players = await sql.getPlayers(channel, true);
		for(const i in players) {
			let player = players[i];
			if(this.isFusion(player)) {
				await sql.deletePlayer(player.id);
			} else {
				player.legacyGlory += player.glory;
				player.glory = 0;
				player.level = this.newPowerLevel(0);
				player.gardenLevel = 0;
				player.actionLevel = 0;
				player.fusionId = null;
				player.lastActive = now - 24 * hour;
				player.lastFought = now - 24 * hour;
				await sql.setPlayer(player);
			}
		}

		return 'Onwards, to a new adventure...! All Power Levels and player status has been reverted, but your Glory is preserved as Legacy Glory.';
	},
	// Register a new player.
	async registerPlayer(channel, username, userId, name) {
		let output = [];
		let world = await sql.getWorld(channel);
		const now = new Date().getTime();
		this.addHeat(world, 10);

		let hAdjust = Math.random() + 1.5;
		let aAdjust = Math.random() + 1.5;
		let dAdjust = Math.random() + 1.5;
		const totalAdjust = (hAdjust + aAdjust + dAdjust) / 3;
		hAdjust /= totalAdjust;
		aAdjust /= totalAdjust;
		dAdjust /= totalAdjust;
		let player = {
			name: name,
			username: username,
			userId: userId,
			channel: channel,
			glory: 0,
			legacyGlory: 0,
			level: this.newPowerLevel(world.heat),
			lastActive: now,
			lastFought: now,
			gardenLevel: 0,
			actionLevel: 0,
			fusionId: null,
			hAdjust: hAdjust,
			aAdjust: aAdjust,
			dAdjust: dAdjust,
			intent: 0
		};
		player.hp = this.getMaxHP(player);
		await sql.addPlayer(player);
		console.log(`Registered ${username} as ${name}`);
		output.push(`Registered player ${name}!`);
		output.push(await this.getPlayerDescription(await sql.getPlayerByUsername(channel, username), username, false));

		return output;
	},
	async train(player, type) {
		await this.deleteStatus(player, enums.Statuses.Ready);

		let trainingType = enums.TrainingTypes.Neutral;
		let message = `**${player.name}** has begun training.`;;
		if('attack'.startsWith(type)) {
			trainingType = enums.TrainingTypes.Attack
			message = `**${player.name}** has begun training, prioritizing attack.`;
		} else if('defense'.startsWith(type)) {
			trainingType = enums.TrainingTypes.Defense
			message = `**${player.name}** has begun training, prioritizing defense.`;
		} else if('health'.startsWith(type) || type == 'hp') {
			trainingType = enums.TrainingTypes.Health
			message = `**${player.name}** has begun training, prioritizing health.`;
		}
		
		await sql.addStatus(player.channel, player.id, enums.Statuses.Training, 0, trainingType);
		return message;
	},
	async updatePlayerActivity(channel, lastUpdate, pings) {
		let world = await sql.getWorld(channel);
		let players = await sql.getPlayers(channel);
		const now = new Date().getTime();
		let messages = [];

		let activePlayers = 0;
		for(const i in players) {
			const p = players[i];
			if(this.isFusionPart(p)) continue;
			if(p.npc) continue;
			
			if(p.lastActive > now) {
				p.lastActive = now;
				await sql.setPlayer(p);
			}
			if(p.lastFought > now) {
				p.lastFought = now;
				await sql.setPlayer(p);
			}
			if(p.lastActive + 24 * hour > now) {
				// Player is active
				activePlayers++;
			}
		}

		if(activePlayers > world.population) {
			console.log(`Updating world max active population for ${activePlayers} active players`);
			world.population = activePlayers;
		}
		await sql.setWorld(world);

		return messages;
	},
	async deleteExpired(channel, pings) {
		let expired = await sql.getExpired(channel);
		const now = new Date().getTime();
		let messages = [];

		// React to statuses ending
		for(const i in expired.statuses) {
			let status = expired.statuses[i];
			let player = await sql.getPlayerById(status.playerId);
			let decrease;
			switch(status.type) {
				case enums.Statuses.Dead:
				    // Death
					messages.push(`**${player.name}** is ready to fight.`);
					player.hp = this.getMaxHP(player);
					await sql.setPlayer(player);
					if(player.config.AutoTrain && player.config.AutoTrain != 'Off' && player.config.AutoTrain != 'false') {
						await this.deleteStatus(player, enums.Statuses.Ready);
						let trainingType = enums.TrainingTypes.Neutral;
						switch(player.config.AutoTrain) {
							case 'Attack':
								trainingType = enums.TrainingTypes.Attack;
								messages.push(`**${player.name}** has begun training, prioritizing Attack.`);
								break;
							case 'Defense':
								trainingType = enums.TrainingTypes.Defense;
								messages.push(`**${player.name}** has begun training, prioritizing Defense.`);
								break;
							case 'Health':
								trainingType = enums.TrainingTypes.Health;
								messages.push(`**${player.name}** has begun training, prioritizing Health.`);
								break;
							default:
								messages.push(`**${player.name}** has begun training.`);
								break;
						}
						await sql.addStatus(channel, player.id, enums.Statuses.Training, 0, trainingType);
					} else if(player.isUnderling) {
						const message = await this.underlingPowerup(player);
						if(message) messages.push(message);
					} else {
						await sql.addStatus(channel, player.id, enums.Statuses.Ready);
					}
					if(pings && player.config.Ping) pings.push(await this.getPings(player));
					break;
				case enums.Statuses.Bean: 
					// Bean
					decrease = this.getPowerLevel(player) - this.getPowerLevel(player) / 1.12;
					messages.push(`**${player.name}** is no longer bean-boosted; power level fell by ${numeral(decrease.toPrecision(2)).format('0,0')}.`);
					break;
				case enums.Statuses.Fused:
					// Fusion
					await this.breakFusion(channel, player.id, player.fusedPlayers[0].id, player.fusedPlayers[1].id, pings, messages);
					break;
			}
		}

		let offerIds = []
		for(const i in expired.offers) {
			const offer = expired.offers[i];
			let player = await sql.getPlayerById(offer.playerId); 	
			if(player.lastActive + hour < now && player.lastActive + 24 * hour > now) {
				// The player is idle, but not SUPER idle - stall the offer timer
				await sql.delayOffer(channel, player.id, offer.targetId, offer.type);
			} else if(offer.expires < now) {
				// The offer has expired!
				switch(offer.type) {
					case enums.OfferTypes.Taunt:
						// Failed taunt - reduce their Glory
						let target = await sql.getPlayerById(offer.targetId);
						const glory = Math.ceil(Math.min(Math.min(target.level / player.level * 5, 50)), target.glory);
						target.glory -= glory;
						await sql.setPlayer(target);
						messages.push(`**${target.name}** failed to respond to **${player.name}**; Glory -${glory}.`);
						break;
				}
				offerIds.push(offer.ID);
			}
		}

		// Delete 'em
		for(const status of expired.statuses) {
			if(status.type != enums.Statuses.Cooldown || status.rating != enums.Cooldowns.Ruin) {
				await this.deleteStatusById(null, status.id);
			}
		}
		for(const i in offerIds) {
			const offer = expired.offers[i];
			await sql.deleteOffer(offer.playerId, offer.targetId, offer.type);
		}

		return messages;
	},
	async regenPlayers(channel) {
		let players = await sql.getPlayers(channel, false);
		let world = await sql.getWorld(channel);
		let now = new Date().getTime();
		let messages = [];

		let minutes = (now - world.lastUpdate) / 60000;
		for(const i in players) {
			const p = players[i];
			if(!p.status.find(s => s.type == enums.Statuses.Dead)) {
				const maxHp = this.getMaxHP(p);
				if(p.hp < maxHp) {
					p.hp = Math.min(maxHp, p.hp + maxHp * settings.RegenRate / 100 * minutes);
					if(p.hp == maxHp) {
						messages.push(`${p.name} has recovered to full health.`);
					}
					await setPlayer(p);
				}
			}
		}

		return messages;
	},
	// Process updating passive changes in the world - offers and statuses expiring, garden updating, etc.
	async updateWorld(channel) {
		const now = new Date().getTime();
		let world = await sql.getWorld(channel);
		if(!world) {
			return {embed: null, abort: false, pings: []};
		}

		let messages = [];
		let pings = [];
		let abort = false;

		if(world.startTime && world.startTime < now) {
			messages = messages.concat(await this.deleteExpired(channel, pings));
			messages = messages.concat(await this.updatePlayerActivity(channel, world.lastUpdate, pings));
			messages = messages.concat(await this.regenPlayers(channel));
		}

		await sql.setUpdateTime(channel);
		
		await sql.cleanupBattles();

		// Combine single-line messages
		const lineUpdates = messages.filter(m => m && (typeof m == 'string' || m instanceof String));
		const embedUpdates = messages.filter(m => m && (typeof m == 'object' || m instanceof Discord.RichEmbed) && !m.target);
		const remoteUpdates = messages.filter(m => m && m.target);

		if(lineUpdates.length > 0) {
			let embed = new Discord.RichEmbed();
			embed.setTitle('Status Update')
				.setColor(0x00AE86)
				.setDescription(lineUpdates.join('\n'));
			embedUpdates.push(embed);
		}
		for(const remoteUpdate of remoteUpdates) {
			embedUpdates.push(remoteUpdate);
		}

		return {updates: embedUpdates, abort: abort, pings: pings.join(', ')};
	},
	async config(player, configFlag, value) {
		if(configFlag) {
			// Update the config
			let cf = configFlag.toLowerCase();
			let v = value.toLowerCase();
			switch(cf) {
				case 'alwaysprivate':
					player.config.AlwaysPrivate = this.readConfigBoolean(v, player.config.AlwaysPrivate);
					break;
				case 'ping':
					player.config.Ping = this.readConfigBoolean(v, player.config.Ping);
					break;
				case 'autotrain':
					if(v == 'off') {
						player.config.AutoTrain = 'Off';
					} else if('attack'.startsWith(v)) {
						player.config.AutoTrain = 'Attack';
					} else if('defense'.startsWith(v)) {
						player.config.AutoTrain = 'Defense';
					} else if('health'.startsWith(v) || v == 'hp') {
						player.config.AutoTrain = 'Health';
					} else {
						player.config.AutoTrain = 'On';
					}
					break;
				case 'pronoun':
					if(v.startsWith('he')) {
						player.config.Pronoun = 'he';
					} else if(v.startsWith('she')) {
						player.config.Pronoun = 'she';
					} else {
						player.config.Pronoun = 'they';
					}
					break;
			}
		}

		await sql.setPlayer(player);
		return this.displayConfig(player);
	},
	async displayConfig(player) {
		let embed = new Discord.RichEmbed();
		const config = player.config;
		embed.setTitle(`${player.name} Config`)
			.setColor(0x00AE86);
		let output = `AlwaysPrivate: ${config.AlwaysPrivate ? 'On' : 'Off'}\n`;
		output += `Ping: ${config.Ping ? 'On' : 'Off'}\n`;
		output += `AutoTrain: ${config.AutoTrain ? config.AutoTrain : 'Off'}\n`;
		output += `Pronoun: ${config.Pronoun}`;
		embed.setDescription(output);

		return embed;
	},
	getPowerLevel(player) {
		let level = player.level;
		// Transformation
		const transform = player.status.find(s => s.type == enums.Statuses.Transform || s.type == enums.Statuses.SuperTransform || s.type == enums.Statuses.UltimateForm);
		if(transform) {
			level *= transform.rating;
		}
		// Power Wish
		if(player.status.find(s => s.type == enums.Statuses.PowerWish)) {
			level *= 1.5;
		}
		// Fusion
		if(player.status.find(s => s.type == enums.Statuses.Fused)) {
			level *= 1.3;
		}
		// Bean
		if(player.status.find(s => s.type == enums.Statuses.Bean)) {
			level *= 1.12;
		}
		// Energized
		if(player.status.find(s => s.type == enums.Statuses.Energized)) {
			level *= 1.3;
		}
		// Self Destruct
		if(player.status.find(s => s.type == enums.Statuses.SelfDestruct)) {
			level *= 4;
		}

		return level;
	},
	getMaxHP(player) {
		const p = Math.sqrt(player.level);
		return Math.ceil(p * player.hAdjust * settings.HealthMultiplier);
	},
	getAttack(player) {
		const p = Math.sqrt(player.level);
		return Math.ceil(p * player.aAdjust * settings.AttackMultiplier);
	},
	getDefense(player) {
		const p = Math.sqrt(player.level);
		return Math.ceil(p * player.dAdjust * settings.DefenseMultiplier);
	},
	readConfigBoolean(v, oldValue) {
		if(v == 'off' || v == '0' || v == 'false') {
			return false;
		} else if(v == 'on' || v == '1' || v == 'true') {
			return true;
		}
		return oldValue;
	},
	their(pronoun) {
		switch(pronoun) {
			case 'he':
				return 'his';
			case 'she':
				return 'her';
			default:
				return 'their';
		}
	},
	them(pronoun) {
		switch(pronoun) {
			case 'he':
				return 'him';
			case 'she':
				return 'her';
			default:
				return 'them';
		}
	},
	are(pronoun) {
		switch(pronoun) {
			case 'he':
				return 'is';
			case 'she':
				return 'is';
			default:
				return 'are';
		}
	},
	have(pronoun) {
		switch(pronoun) {
			case 'he':
				return 'have';
			case 'she':
				return 'have';
			default:
				return 'has';
		}
	},
	async history(player1, player2) {
		let history = await sql.getHistory(player1.id, player2 ? player2.id : null);
		let embed = new Discord.RichEmbed();
		const twoPlayers = player2 && player2.id != player1.id;

		if(twoPlayers) {
			embed.setTitle(`${player1.name} VS ${player2.name} Battle History`);
		} else {
			embed.setTitle(`${player1.name} Battle History`);
		}
		embed.setColor(0x00AE86);
		
		let description = '';
		if(twoPlayers) {
			if(history.length == 0) {
				description += `${player1.name} and ${player2.name} have never fought.`;
			} else {
				const player1wins = history.filter(h => h.winnerId == player1.id).length;
				const player2wins = history.filter(h => h.winnerId == player2.id).length;
				if(player1wins > 1) {
					description += `${player1.name} has beaten ${player2.name} ${player1wins} times.\n`;
				} else if(player1wins == 1) {
					description += `${player1.name} has beaten ${player2.name} once.\n`;
				} else {
					description += `${player1.name} has never beaten ${player2.name}.\n`;
				}
				if(player2wins > 1) {
					description += `${player2.name} has beaten ${player1.name} ${player2wins} times.\n`;
				} else if(player2wins == 1) {
					description += `${player2.name} has beaten ${player1.name} once.\n`;
				} else {
					description += `${player2.name} has never beaten ${player1.name}.\n`;
				}
			}
		} else {
			if(history.length == 0) {
				description = `${player1.name} has never fought.`;
			} else {
				const player1wins = history.filter(h => h.winnerId == player1.id).length;
				const player1losses = history.length - player1wins;
				description += `${player1.name} has won ${player1wins} ${player1wins == 1 ? 'time' : 'times'} and lost ${player1losses} ${player1losses == 1 ? 'time' : 'times'}.\n`;
			}
		}
		embed.setDescription(description);

		let output = '';
		if(history.length > 10) history = history.slice(0, 10);
		for(const i in history) {
			const h = history[i];

			if(output.length > 0) output += '\n';

			const loserRating = Math.sqrt(h.loserLevel * h.loserSkill);
			const winnerRating = Math.sqrt(h.winnerLevel * h.winnerSkill);
			const winnerName = h.winnerName ? h.winnerName : 'Someone';
			const loserName = h.loserName ? h.loserName : 'Someone';
			output += `Episode ${h.episode}: ${winnerName} defeated ${loserName}, ${numeral(winnerRating.toPrecision(2)).format('0,0')} to ${numeral(loserRating.toPrecision(2)).format('0,0')}.`;
		}
		if(output) {
			embed.addField(`Last ${history.length} ${history.length == 1 ? 'fight' : 'fights'}`, output);
		}

		return embed;
	},
	async graveyard(channel) {
		let players = await sql.getPlayers(channel);
		const deadPlayers = players.filter(p => p.status.find(s => s.type == enums.Statuses.Dead));
		deadPlayers.sort((a, b) => {
			const aDeath = a.status.find(s => s.type == enums.Statuses.Dead);
			const bDeath = b.status.find(s => s.type == enums.Statuses.Dead);
			return aDeath.endTime - bDeath.endTime;
		});
		const now = new Date().getTime();
		let output = '';

		let embed = new Discord.RichEmbed();
		embed.setTitle(`Defeated Players`)
			.setColor(0x00AE86);
		
		for(const i in deadPlayers) {
			const p = deadPlayers[i];
			const s = p.status.find(s => s.type == enums.Statuses.Dead);
			
			if(output.length > 0) output += '\n';
			output += `${p.name} (Recovers in ${this.getTimeString(s.endTime - now)})`;
		}

		if(output.length == 0) {
			output = `No players are in need of healing right now.`;
		}

		embed.setDescription(output);

		return embed;
	},
	async worldInfo(channel) {
		const world = await sql.getWorld(channel);
		const now = new Date().getTime();
		let embed = new Discord.RichEmbed();
		let output = `This world has existed for ${this.getTimeString(now - world.startTime)}.`;

		if(world.resets > 0) {
			output += ` It has been reset ${world.resets} ${world.resets == 1 ? 'time' : 'times'}.`;
		}

		if(world.arc) {
			const arcType = enums.ArcTypes.Name[world.arc.type];
			output += `\nThe current arc is a **${arcType} Arc**, and has been ongoing for ${this.getTimeString(now - world.arc.startTime)}.`;
		}

		if(world.lastArc && world.lastArc.type != enums.ArcTypes.Filler) {
			const arcType = enums.ArcTypes.Name[world.lastArc.type];
			output += `\nThe previous arc was a **${arcType} Arc**, and lasted for ${this.getTimeString(world.lastArc.endTime - world.lastArc.startTime)}.`;
		}

		output += `\nThere are currently ${world.population} active players in this universe.`;

		for(var cooldown of world.cooldowns) {
			// Stub
		}

		embed.setTitle(`UNIVERSE ${world.id}`)
			.setColor(0x00AE86)
			.setDescription(output);
		return embed;
	},
	async ending(channel) {
		await this.endWorld(channel);
		return 'This story has reached an ending, but there are more adventures on the horizon. Onwards, to a new universe...!\n' +
			'To see the final standing, enter \`!scores\`.';
	},
	shuffle(a) {
		var j, x, i;
		for (i = a.length - 1; i > 0; i--) {
			j = Math.floor(Math.random() * (i + 1));
			x = a[i];
			a[i] = a[j];
			a[j] = x;
		}
		return a;
	},
	async getPings(player) {
		if(this.isFusion(player)) {
			const fusedPlayer1 = await sql.getPlayerById(player.fusedPlayers[0].id);
			const fusedPlayer2 = await sql.getPlayerById(player.fusedPlayers[1].id);
			return `<@${fusedPlayer1.userId}>, <@${fusedPlayer2.userId}>`;
		} else {
			return `<@${player.userId}>`;
		}
	},
	async filler(player, target) {
		const channel = player.channel;
		const players = await sql.getPlayers(channel);
		const world = await sql.getWorld(channel);
		const now = new Date().getTime();

		const fillerTemplates = templates.FillerTemplates;
		let summary = fillerTemplates[Math.floor(Math.random() * fillerTemplates.length)];

		let playerCount = 2;
		if(summary.indexOf('$3')) playerCount = 4;
		else if(summary.indexOf('$2')) playerCount = 3;

		// Gather our cast
		let cast = [player];
		if(target) cast.push(target);

		let remainingPlayers = players.filter(p => p.id != player.id && (!target || p.id != target.id) && !this.isFusionPart(p));
		this.shuffle(remainingPlayers);
		while(cast.length < playerCount) {
			cast.push(remainingPlayers[0]);
			remainingPlayers = remainingPlayers.slice(1);
		}

		// Fill in the template
		for(const i in cast) {
			const p = cast[i];
			summary = summary.replace(new RegExp(`\\$${i}their`, 'g'), this.their(p.config.pronoun));
			summary = summary.replace(new RegExp(`\\$${i}them`, 'g'), this.them(p.config.pronoun));
			summary = summary.replace(new RegExp(`\\$${i}`, 'g'), p.name);
		}

		let embed = new Discord.RichEmbed();
		embed.setTitle(`EPISODE ${world.episode}`)
			.setColor(0x00AE86)
			.setDescription(summary);
		
		await sql.addEpisode(channel, summary);

		let defeatedPlayers = cast.filter(p => p.status.find(s => s.type == enums.Statuses.Dead));
		if(defeatedPlayers) {
			const healing = 12 * 60 * 1000 / (defeatedPlayers.length + 1) * (1 + player.actionLevel * 0.025);
			for(const p of defeatedPlayers) {
				if(p.id == player.id) {
					await this.revivePlayer(p, 2 * healing);
				} else {
					await this.revivePlayer(p, healing);
				}
			}
		}
		await this.actionLevelUp(player);

		
		return embed;
	},
	async getEpisode(channel, number) {
		const episodeNumber = parseInt(number);

		const episode = await sql.getEpisode(channel, episodeNumber);
		if(!episode) return;

		const airDate = moment(episode.airDate).format('MMM Do');
		let embed = new Discord.RichEmbed();
		embed.setTitle(`EPISODE ${episodeNumber}`)
			.setColor(0x00AE86)
			.setDescription(`Original Air Date: ${airDate}`)
			.addField('Episode Summary', episode.summary);

		return embed;
	},
	async revivePlayer(player, amount) {
		const now = new Date().getTime();
		const channel = player.channel;
		let defeatedState = player.status.find(s => s.type == enums.Statuses.Dead);
		if(defeatedState) {
			const duration = defeatedState.endTime - now;
			if(amount && duration > amount) {
				// Reduce timer
				defeatedState.endTime -= amount;
				await sql.setStatus(defeatedState);
				return defeatedState;
			} else {
				// Revive
				await this.deleteStatusById(player, defeatedState.id);

				if(player.config.AutoTrain && !player.isUnderling) {
					await this.deleteStatus(player, enums.Statuses.Ready);
					await sql.addStatus(channel, player.id, enums.Statuses.Training);
				} else if(player.isUnderling) {
					await this.underlingPowerup(player);
				} else {
					await sql.addStatus(channel, player.id, enums.Statuses.Ready);
				}
				return null;
			}
		}
	},
	async testMethod(player, param) {
		let output = '';
		
		let flawLibrary = [
			{ cost: 2, levelUp: 1, speed: 1, id: 'slow', namePattern: '^slow$' },
			{ cost: 3, levelUp: 2, speed: 0, id: 'weakPhysicalAttacker', namePattern: '^weak physical attack' },
			{ cost: 3, levelUp: 2, speed: 0, id: 'weakEnergyAttacker', namePattern: '^weak energy attack' }
		];
		let techFlawList = ['slow', 'weak physical attack'];
		for(const flawName in techFlawList) {
			const flawData = flawLibrary.find(f => {
				return flawName.match(f.namePattern);
			});
			if(flawData) techflaws.push(flawData);
		}
		return output;
	},
	async confirmCommand(player, username, command) {
		const askingPlayer = player.fusedPlayers[0].username == username ? player.fusedPlayers[0] : player.fusedPlayers[1];
		const otherPlayer = player.fusedPlayers[0].username == username ? player.fusedPlayers[1] : player.fusedPlayers[0];
		const existingOffer = askingPlayer.offers.find(o => o.playerId == otherPlayer.id && 
			o.type == enums.OfferTypes.Confirmation &&
			o.extra.toLowerCase() == command.toLowerCase());
		if(existingOffer) { 
			await sql.deleteOfferById(existingOffer.id);
			return true;
		} else {
			await sql.addOffer(askingPlayer, otherPlayer, enums.OfferTypes.Confirmation, command);
			return false;
		}
	},
	async killPlayer(player, duration) {
		if(duration <= 0) return;

		const defeatedState = player.status.find(s => s.type == enums.Statuses.Dead);
		if(defeatedState) {
			const now = new Date().getTime();
			const newEndTime = now + duration;
			if(defeatedState.endTime < newEndTime) {
				defeatedState.endTime = newEndTime;
				await sql.setStatus(defeatedState);
				return;
			}
		}

		const training = player.status.find(s => s.type == enums.Statuses.Training);
		const journey = player.status.find(s => s.type == enums.Statuses.Journey);
		
		if(training) {
			await this.completeTraining(player);
		}
		
		if(player.npc) {
			await sql.addStatus(player.channel, player.id, enums.Statuses.Annihilation);
		} else {
			await sql.addStatus(player.channel, player.id, enums.Statuses.Dead, duration);
		}
		await sql.deleteOffersForPlayer(player.id);

		await sql.setPlayer(player);
	},
	async deleteStatus(player, type) {
		await sql.deleteStatus(player.id, type);
		for(let i = 0; i < player.status.length; i++) {
			const status = player.status[i];
			if(status.type == type) {
				player.status.splice(i, 1);
				return;
			}
		}
	},
	async deleteStatusById(player, statusId) {
		await sql.deleteStatusById(statusId);
		if(player) {
			for(let i = 0; i < player.status.length; i++) {
				const status = player.status[i];
				if(status.id == statusId) {
					player.status.splice(i, 1);
					return;
				}
			}
		}
	},
	getGlory(player, amount) {
		return Math.floor(amount * (1 + Math.sqrt(player.legacyGlory/750)));
	},
	async useTechnique(player, techName) {
		let tech = Object.values(enums.Techniques).find(t => enums.Techniques.Name[t].toLowerCase().startsWith(techName.toLowerCase()));
		if(tech) {
			await sql.setIntent(player, tech);
		}
	}
}
