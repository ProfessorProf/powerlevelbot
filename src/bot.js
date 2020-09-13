const Discord = require("discord.js");
const client = new Discord.Client();
const auth = require('../auth.json');
const tools = require('./tools.js');
const fight = require('./fight.js');
const validation = require('./validation.js');
const sql = require ('./sql.js');
const help = require('./help.js');

let debugMode = false;
process.argv.forEach((val, index) => {
	if(val == '--debug') {
		debugMode = true;
	}
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username}!`);

	sql.getChannels().then(async channels => {;
		const now = new Date().getTime();
		if(channels.length > 0) {
			for(const i in channels) {
				const c = channels[i];
				const channel = client.channels.find(x => x.id == c);
				if(channel && channel.name == auth.channel) {
					if(debugMode) {
						channel.send(`Bot in debug mode. Only the admin can use commands.`);
					} else {
						let world = await sql.getWorld(c);
						channel.send(`Bot online! Greetings, Universe ${world.id}.`);
						const downtime = now - world.lastUpdate
						console.log(`(${c}) Downtime ${tools.getTimeString(downtime)}`);
						if(world && world.lastUpdate && downtime > 5 * 1000 * 60) {
							await sql.fastForward(c, downtime);
							channel.send(`Bot was offline for about ${tools.getTimeString(downtime)}.`);
						}
					}
				}
			}
		}
	});
	
    setInterval(async function() {
		const channels = await sql.getChannels();
		let updatedChannels = [];
		for(const i in channels) {
			const c = channels[i];
			
			const update = await tools.updateWorld(c);
			if(update.updates && update.updates.length > 0) {
				updatedChannels.push(c);
				const channel = client.channels.find(x => x.id == c);
				if(channel) {
					if(channel.name == auth.channel) {
						for(var u of update.updates) {
							if(u) channel.send(u);
						}
						if(update.pings) {
							channel.send(update.pings);
						}
					}
				} else {
					console.log(`Unrecognized channel ${c}`);
				}
			}
		}
		const now = new Date();
		if(updatedChannels.length > 0) {
			console.log(`${now.toLocaleString('en-US')}: Update completed for channels ${updatedChannels.join(', ')}`);
		}
    }, 60000);
});

client.on('disconnect', function(msg, code) {
	const now = new Date();
	console.log(`Disconnected at ${now.toLocaleString("en-US")}`);
	if (code === 0) return console.error(msg);
});

client.on('error', (e) => {
	console.log(e);
});

client.on('message', message => {
    // Our bot needs to know if it will execute a command
	// It will listen for messages that will start with `!`
	if(message.author.bot) return;

    if (message.channel.name == auth.channel &&
        message.content.substring(0, 1) == '!') {
		handleMessage(message).then(() => {}, 
			(err) => {
				let errorMessage = `Error: ${err.message}`;
				if(auth.adminId) errorMessage += ` <@${auth.adminId}>\n The admin has been notified. If possible, try not to touch this feature until they get here.`;
				message.channel.send(errorMessage);
				console.log(err);
			}
		);
	}
});

async function handleMessage(message) {
	if(debugMode) {
		let debuggerRole = message.member.roles.get(auth.debuggerRole);
		if(message.author.username != auth.admin && !debuggerRole) {
			return;
		}
	}
	const now = new Date().getTime();
	let username = message.author.username;
	let args = message.content.substring(1).split(' ');
	let cmd = args[0].toLowerCase();
	args = args.splice(1);

	const channel = message.channel.id;
	let overrideErrors = false;

	let output = {
		messages: [],
		private: false,
		informational: false,
		fight: false
	};

	if(cmd.substring(0,2) == '!!' && username == auth.admin) {
		overrideErrors = true;
		cmd = cmd.substring(2);
	}

    if(cmd.substring(0, 1) == '!') {
		output.private = true;
		cmd = cmd.substring(1);
	}

	if(cmd == 'as' && username == auth.admin) {
		username = args[0];
		cmd = args[1].toLowerCase();
		args = args.splice(2);
	}

	if(cmd == 'update' ) {
		message.channel.send('Beginning update...');
		try {
			await sql.update();
			message.channel.send(`Update complete.`);
		} catch (e) {
			console.log(e);
		}
		const endTime = new Date().getTime();
		const duration = (endTime - now) / 1000;
		console.log(`${channel}: Command "${message.content}" completed for player ${username} in ${duration} seconds`);
		return;
	}

	if(cmd == 'init' ) {
		message.channel.send('Beginning initialization...');
		try {
			await sql.initializeGame()
		} catch (e) {
			console.log(e);
		}
		const world = await sql.initializeChannel(channel);
		message.channel.send(`Initialization complete for Universe ${world.id}.`);
		const endTime = new Date().getTime();
		const duration = (endTime - now) / 1000;
		console.log(`${channel}: Command "${message.content}" completed for player ${username} in ${duration} seconds`);
		return;
	}

	if(!(await sql.worldExists(channel))) {
		return;
	}

	if(cmd != 'debug') {
		const update = await tools.updateWorld(channel);

		if(update.updates) {
			for(var u of update.updates) {
				if(u) {
					if(u.target) {
						const targetChannel = client.channels.find(x => x.id == u.target);
						targetChannel.send(u.message);
					} else {
						message.channel.send(u);
					}
				}
			}
			if(update.pings) {
				message.channel.send(update.pings);
			}
		}
		
		if(update.abort) return;
	}

	let targetName;
	if(cmd == 'use' || cmd == 'give' || cmd == 'steal') {
		targetName = args.length > 1 ? args[1] : null;
	} else {
		targetName = args.length > 0 ? args[0] : null;
	}
	let player = await sql.getPlayerByUsername(channel, username);
	let target = await sql.getPlayer(channel, targetName);
	
	const errors = await validation.validate(channel, username, player, target, cmd, args);
	if(errors) {
		if(overrideErrors) {
			errors.push('(Override Errors)');
		}
		message.channel.send({embed: {
			title: 'Error',
			description: errors.join('\n')
		}});
		if(!overrideErrors) {
			return;
		}
	}

	// Check if the user has AlwaysPrivate enabled
	if(player && player.config && player.config.AlwaysPrivate) {
		output.private = !output.private;
	}
	
	switch(cmd) {
		case 'reg':
			output.messages = await tools.registerPlayer(channel, username, message.author.id, args[0]);
			break;
		case 'check':
			output.messages = await tools.getPlayerDescription(player, username, output.private);
			output.informational = true;
			break;
		case 'deepcheck':
			output.messages = await tools.getPlayerDeepDescription(player);
			output.informational = true;
			break;
		case 'roster':
			output.messages = await tools.displayRoster(channel);
			output.informational = true;
			break;
		case 'scan':
			output.messages = await tools.scoutPlayer(target);
			output.informational = true;
			break;
		case 'fight':
			output.messages = await tools.tryFight(player, target);
			if(output.messages[output.messages.length - 1].title.includes('vs'))
				output.fight = true;
			break;
		case 't':
		case 'tech':
			await tools.useTechnique(player, args[0]);
			break;
		case 'unfight':
			output.messages = await tools.unfight(player);
			break;
		case 'train':
			output.messages = await tools.train(player, args[0]);
			break;
		case 'season':
			output.messages = await tools.resetData(channel);
			break;
		case 'scores':
			output.messages = await tools.displayScores(channel);
			output.informational = true;
			break;
		case 'history':
			output.messages = await tools.history(player, target);
			output.informational = true;
			break;
		case 'graveyard':
			output.messages = await tools.graveyard(channel);
			output.informational = true;
			break;
		case 'world':
			output.messages = await tools.worldInfo(channel);
			output.informational = true;
			break;
		case 'taunt':
			output.messages = await tools.taunt(player, target);
			break;
		case 'filler':
			output.messages = await tools.filler(player, target);
			break;
		case 'episode':
			output.messages = await tools.getEpisode(channel, args[0]);
			break;
		case 'config':
			output.messages = await tools.config(player, args[0], args[1]);
			output.informational = true;
			break;
		case 'help':
			output.messages = await help.showHelp(player, args[0]);
			output.informational = true;
			break;
		case 'debug':
			await sql.execute(args.join(' '));
			break;
		case 'clone':
			await sql.clone(player, args[0]);
			break;
		case 'ending':
			output.messages = await tools.ending(channel);
			break;
		case 'test':
			output.messages = await tools.testMethod(player, args[0]);
			break;
		case 'update':
			await sql.update();
			break;
		case 'importchannel':
			await sql.importChannel(channel, args[0]);
			break;
	}

	if(!output.informational) {
		output.private = false;
	}

	// Display the output
	if(output.messages && !Array.isArray(output.messages)) {
		output.messages = [output.messages];
	}
	
	if(output.messages && output.messages.length > 0) {
		for(const i in output.messages) {
			const m = output.messages[i];
			if(m) {
				if(output.informational && output.private) {
					await message.author.send(m);
				} else if(m.target) {
					// Send the message to a different channel
					const targetChannel = client.channels.find(x => x.id == m.target);
					await targetChannel.send(m.message);
				} else {
					message.channel.send(m)
						.then((sentMessage) => {
							if(output.fight && sentMessage.embeds && sentMessage.embeds.length > 0) {
								// Ensure this is the fight embed
								let embed = sentMessage.embeds[0];
								if(embed && embed.title.includes(' vs ')) {
									fight.continueFight(player, target, sentMessage);
								}
							}
						});
				}
			}
		}
	}
	await sql.playerActivity(channel, username);
	const endTime = new Date();
	const duration = (endTime.getTime() - now) / 1000;
	console.log(`(${channel}) ${endTime.toLocaleString("en-US")}: Command "${message.content}" completed for ${username} in ${duration} seconds`);
}

client.login(auth.token);
