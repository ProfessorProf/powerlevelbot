const tools = require('./tools.js');
const sql = require('./sql.js');
const auth = require('../auth.json');
const enums = require('./enum.js');

let hour = (60 * 60 * 1000);

module.exports = {
    // Returns an error string if the command is illegal
    async validate(channel, username, player, target, cmd, args) {
		let world = await sql.getWorld(channel);
		let glory = player ? player.glory : 0;
		if(player && player.fusedPlayers.length == 2) {
			glory /= 2;
		}
		let errors = [];
		let now = new Date().getTime();
		if((!world || !world.startTime) &&
			cmd != 'scores' && cmd != 'debug' && cmd != 'season') {
			errors.push(`A new universe is waiting to be born.`);
			return errors;
		}
		if(world && world.startTime > now &&
			cmd != 'scores' && cmd != 'debug') {
			let duration = world.startTime - now;
			errors.push(`A new universe will be born in ${tools.getTimeString(duration)}.`);
			return errors;
		}

		switch(cmd) {
			case 'reg':
				// !reg validation rules:
				// - Player must not already be registered
				// - Name must not be taken
				// - Name must not contain spaces
				const regName = args[0];
				if(player) {
					errors.push('You have already registered!');
				}
				if(!regName) {
					errors.push('You must specify a character name.');
				}
				if(args.length > 1) {
					errors.push('Name must not contain spaces.');
				} else {
					if(target) {
						errors.push(`There is already a character named ${player.name}.`);
					}
				}
				break;
			case 'check':
				this.validatePlayerRegistered(errors, player);
				break;
			case 'fight':
				// !fight validation rules:
				// - Target must exist if specified
				// - Player and Target must be different people
				// - Player and Target must both be alive
				// - Player and Target must not be fighting
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					const defeated = player.status.find(s => s.type == enums.Statuses.Dead);
					if(defeated) {
						errors.push(`**${player.name}** cannot fight for another ${tools.getTimeString(defeated.endTime - now)}.`);
					}
					if(target) {
						this.validateAnnihilation(errors, target);
						if(player.name == target.name) {
							errors.push('You cannot fight yourself!');
						}
						const targetDefeated = target.status.find(s => s.type == enums.Statuses.Dead);
						if(targetDefeated) {
							errors.push(`**${target.name}** cannot fight for another ${tools.getTimeString(targetDefeated.endTime - now)}.`);
						}
						const offer = player.offers.find(o => o.playerId == target.id && 
							(o.type == enums.OfferTypes.Fight || o.type == enums.OfferTypes.Taunt));
						if(!offer) {
							// You're issuing a challenge - validate the cooldown
							const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Challenge);
							if(cooldown) {
								errors.push(`**${player.name}** cannot initiate a fight for another ${tools.getTimeString(cooldown.endTime - now)}.`);
							}
						}
						if(target.battleId) {
							errors.push(`You are already fighting.`);
						}
						if(player.battleId) {
							errors.push(`That person is already fighting.`);
						}
					} else if(args.length > 0) {
						errors.push(`The player "${args[0]}" could not be found.`);
					} else {
						// You're issuing an open challenge - validate the cooldown
						const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Challenge);
						if(cooldown) {
							errors.push(`**${player.name}** cannot initiate a fight for another ${tools.getTimeString(cooldown.endTime - now)}.`);
						}
					}
				}
				break;
			case 'train':
				// !train validation rules:
				// - Must be alive
				// - Must have lost a fight since they last stopped training
				// - Must not be training
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					if(player.status.find(s => s.type == enums.Statuses.Training)) {
						errors.push(`**${player.name}** is already training.`);
					} else {
						const defeated = player.status.find(s => s.type == enums.Statuses.Dead);
						if(defeated) {
							const timeString = tools.getTimeString(defeated.endTime - now);
							errors.push(`**${player.name}** cannot train for another ${timeString}.`);
						} else {
							if(!player.status.find(s => s.type == enums.Statuses.Ready)) {
								errors.push(`**${player.name}** must lose a fight before they can begin training.`);
							}
						}
					}
				}
				break;
			case 'reset':
			case 'debug':
			case 'clone':
			case 'test':
				// !clone validation rules:
				// - Must be admin
				if(player.username != auth.admin && !player.fusedPlayers.find(p => p.username == auth.admin)) {
					errors.push('Only the game master can use debug commands.');
				}
				break;
			case 'scan':
				// !scan validation
				// - Must specify a valid target
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					if(target) {
						this.validateAnnihilation(errors, target);
						if(player.name == target.name) {
							errors.push('You cannot scan yourself!');
						}
					} else {
						errors.push('Must specify a valid target.');
					}
				}
				break;
			case 'unfight':
				// !unfight validation
				// - Must be registered
				// - Must not be Berserk
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
				}
				break;
			case 'scores':
				// !scores validation rules:
				// - World must have ended
				if(world && world.startTime && world.startTime < now) {
					errors.push('Scores are only available after the season ends.');
				}
				break;
			case 't':
			case 'tech':
				// !tech validation rules:
				// Must know technique
				this.validatePlayerRegistered(errors, player);
				if(args.length == 0) {
					errors.push(`Must specify the technique to be used.`);
				} else {
					if(player) {
						let techName = args[0];
						let techList = Object.values(enums.Techniques);
						techList = techList.slice(0, techList.length - 2);
						let tech = techList.find(t => enums.Techniques.Name[t] && enums.Techniques.Name[t].toLowerCase().startsWith(techName.toLowerCase()));
						if(!tech) {
							errors.push(`Unrecognized technique.`);
						} else {
							if(!player.techs.find(t => t.id == tech)) {
								errors.push(`You don't know that technique.`);
							}
						}
						if(!player.battleId) {
							errors.push(`You must be in a fight to use a technique.`);
						}
					}
				}
				break;
			case 'deepcheck':
			case 'season':
			case 'taunt':
			case 'filler':
			case 'history':
			case 'episode':
			case 'garden':
			case 'search':
			case 'plant':
			case 'nemesis':
				errors.push(`That feature hasn't been implemented yet.`);
				break;
		}

		if(errors.length > 0) {
			return errors;
		} else {
			return null;
		}
	},
	validatePlayerRegistered(errors, player) {
		if(!player) {
			errors.push('Enter `!reg Name` to start playing! You must be registered to use this cmd.');
		}
	},
	validateAnnihilation(errors, player) {
		if(player.status.find(s => s.type == enums.Statuses.Annihilation)) {
			errors.push(`**${player.name}** no longer exists in this world.`);
		}
	},
	validateNotNpc(errors, player) {
		if(player.npc) {
			errors.push(`That action can't target an NPC.`);
		}
	},
	validateActionTime(errors, player) {
		let now = new Date().getTime();
		const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Action);
		if(cooldown) {
			let timeString = tools.getTimeString(cooldown.endTime - now);
			errors.push(`**${player.name}** cannot act for another ${timeString}.`);
		}
	},
	validateGardenTime(errors, player) {
		const now = new Date().getTime();
		const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Garden);
		if(cooldown) {
			let timeString = tools.getTimeString(cooldown.endTime - now);
			errors.push(`**${player.name}** cannot garden for another ${timeString}.`);
		}
	},
	getPlantType(plantName) {
		let plantType = -1;
		if(!plantName) return -1;
		switch(plantName.toLowerCase()) {
			case 'flower':
				plantType = 1;
				break;
			case 'rose':
				plantType = 2;
				break;
			case 'carrot':
				plantType = 3;
				break;
			case 'bean':
				plantType = 4;
				break;
			case 'sedge':
				plantType = 5;
				break;
			case 'fern':
				plantType = 6;
				break;
			case 'gourd':
				plantType = 10;
				break;
			case 'peach':
				plantType = 11;
				break;
			default:
				plantType = -1;
				break;
		}
		return plantType;
	},
	getDarkPlantType(plantName) {
		if(!plantName) return -1;
		switch(plantName.toLowerCase()) {
			case 'zlower':
				return 7;
			case 'zarrot':
				return 8;
			case 'zedge':
				return 9;
			case 'zeach':
				return 13;
			default:
				return -1;
		}
	}
}
