const Discord = require("discord.js");
const client = new Discord.Client();
const auth = require('../auth.json');
const fs = require('fs');
const tools = require('./tools.js');
const validation = require('./validation.js');
const sql = require ('./sql.js');
const help = require('./help.js');

const hour = (60 * 60 * 1000);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.username}!`);
});

client.on('error', (e) => {
	console.log(e);
});

client.on('message', message => {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.channel.name == auth.channel &&
        message.content.substring(0, 1) == '!') {
		try {
			handleMessage(message);
		} catch (e) {
			console.log(e);
		}
	}
});

async function handleMessage(message) {
	let now = new Date().getTime();
	let name = message.author.username;
	let args = message.content.substring(1).split(' ');
	let cmd = args[0].toLowerCase();
	args = args.splice(1);

	let channel = message.channel.id;

	if(cmd == 'as' && name == auth.admin) {
		name = args[0];
		cmd = args[1].toLowerCase();
		args = args.splice(2);
	}

	if(cmd == 'init' ) {
		message.channel.send('Beginning initialization...');
		await sql.initializeGame()
		await sql.initializeChannel(message.channel.id);
		message.channel.send('Initialization complete.');
		let endTime = new Date().getTime();
		let duration = (endTime - now) / 1000;
		console.log(`${message.channel.id}: Command "${message.content}" completed for player ${name} in ${duration} seconds`);
		return;
	}

	let errors = await validation.validate(channel, name, cmd, args);
	if(errors) {
		message.channel.send({embed: {
			title: 'Error',
			description: errors.join('\n')
		}});
		return;
	}
	
	let updateEmbed = await sql.updateWorld(channel);
	if(updateEmbed) message.channel.send({embed: updateEmbed});
	
	let targetName = args[0];
	switch(cmd) {
		case 'reg':
			// Add a new player
			await tools.registerPlayer(channel, name, targetName);
			message.channel.send(`Registered player ${name}!`);
			message.channel.send({embed: await tools.getPlayerDescription(channel, name)});
			break;
		case 'check':
			message.channel.send({embed: await tools.getPlayerDescription(channel, name)});
			break;
		case 'fight':
			message.channel.send({embed: await tools.tryFight(channel, name, targetName)});
			break;
		case 'unfight':
			// TODO
			break;
		case 'attack':
			message.channel.send({embed: await tools.attack(channel, name, targetName)});
			break;
		case 'destroy':
			message.channel.send({embed: await tools.destroy(channel)});
			break;
		case 'burn':
			// TODO
			break;
		case 'recruit':
			// TODO
			break;
		case 'join':
			// TODO
			break;
		case 'banish':
			// TODO
			break;
		case 'energize':
			// TODO
			break;
		case 'revive':
			// TODO
			break;
		case 'train':
			await tools.train(channel, name);
			message.channel.send(`**${name}** has begun training.`);
			break;
		case 'scan':
			message.channel.send({embed: await tools.scoutPlayer(channel, targetName)});
			break;
		case 'reset':
			await tools.resetData(channel);
			message.channel.send('Onwards, to a new universe...! Some Glory is preserved, but all Power Levels and player status has been reverted.');
			break;
		case 'garden':
			message.channel.send({embed: await tools.displayGarden(channel)});
			break;
		case 'plant':
			message.channel.send(await tools.plant(channel, name, targetName));
			break;
		case 'water':
			message.channel.send(await tools.water(channel, name));
			break;
		case 'pick':
			message.channel.send(await tools.pick(channel, name, targetName));
			break;
		case 'use':
			message.channel.send(await tools.useItem(channel, name, args[0], args[1]));
			break;
		case 'expand':
			message.channel.send(await tools.expand(channel, name));
			break;
		case 'search':
			message.channel.send(await tools.search(channel, name));
			break;
		case 'roster':
			const output = await tools.displayRoster(channel);
			message.channel.send(`\`\`\`\n${output}\`\`\``);;
			break;
		case 'fuse':
			const fusionName = args.length > 1 ? args[1] : null;
			message.channel.send(await tools.fuse(channel, message, name, targetName, fusionName));
			break;
		case 'nemesis':
			message.channel.send({embed: await tools.setNemesis(channel, name)});
			message.channel.send({embed: await tools.getPlayerDescription(channel, name)});
			break;
		case 'wish':
			message.channel.send(await tools.wish(channel, name, args[0]));
			break;
		case 'research':
			// TODO
			break;
		case 'overdrive':
			// TODO
			break;
		case 'empower':
			// TODO
			break;
		case 'give':
			// TODO
			break;
		case 'journey':
			// TODO
			break;
		case 'history':
			// TODO
			break;
		case 'graveyard':
			// TODO
			break;
		case 'tournament':
			// TODO
			break;
		case 'taunt':
			// TODO
			break;
		case 'config':
			message.channel.send({embed: await tools.config(channel, name, args[0], args[1])});
			break;
		case 'help':
			message.channel.send({embed: await help.showHelp(args[0])});
			break;
		case 'debug':
			await sql.execute(args[0], args.slice(1).join(' '));
			break;
		case 'clone':
			// Delete this before S3 starts
			await sql.clone(channel, name, targetName);
			break;
		case 'autofight':
			// Delete this before S3 starts
			await sql.autofight(channel, targetName);
			break;
	}
	let endTime = new Date().getTime();
	let duration = (endTime - now) / 1000;
	console.log(`${message.channel.id}: Command "${message.content}" completed for player ${name} in ${duration} seconds`);
}

client.login(auth.token);
