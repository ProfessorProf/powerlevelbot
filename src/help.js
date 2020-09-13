const Discord = require("discord.js");
const sql = require('./sql.js');
const enums = require('./enum.js');

// Logic for displaying help topics.
module.exports = {
    async showHelp(player, topic) {
        let output = new Discord.RichEmbed();
        output.setTitle('Help!')
            .setColor(0x00AE86);

        if(!topic) {
            output.setDescription('To start playing right away, enter `!reg name`! To learn more about a command, enter `!help command`. For more game info:')
                .addField('!help basic', "Help with the game's basic commands: !reg, !check, !config.")
                .addField('!help info', 'Help with informational commands: !check, !scan, !roster,  !graveyard, !history.')
                .addField('!help battle', 'Help with commands related to combat: !fight, !unfight, !tech.')
                .addField('!help tech', 'Help with special battle techniques.')
                .addField('!help rank', 'Help with Rank, Glory, and how to increase them.')
                .addField('Private commands', 'For info commands, you can start the command with `!!` instead of `!` ' +
                    'and it will send the information in a DM.')
        } else {
            switch(topic.toLowerCase()) {
                case 'basic':
                    output.setTitle('Help: Basic Commands')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!reg name', 'Register to start playing the game.')
                        .addField('!config', 'Display or set various configuration flags.')
                        .addField('!check', 'Display information about your character.');
                    break;
                case 'info':
                    output.setTitle('Help: Info Commands')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!check', 'Display information about your character.')
                        .addField('!scan target', 'Scan another player to learn their basic stats.')
                        .addField('!roster', 'Display basic info on all active players.')
                        .addField('!graveyard', 'Display all defeated players.')
                    break;
                case 'config':
                    output.setTitle('Help: Configuration Commands')
                        .addField('!config', 'Displays your current config options.')
                        .addField('!config flag value', 'Set a config setting to a value.')
                        .addField('Config Flags:', '**AlwaysPrivate**: Valid values: "on"/"off". Sends messages via DM by default. If you want a specific message to send via DM, preface it with "!!" instead of "!". ' +
                            'For a list of commands that can be made private, enter `!help info`. Default: Off.\n' +
                            '**Ping**: Valid values: "on"/"off". Mentions you when various important events happen related to your character. Default: Off.\n' + 
                            '**AutoTrain**: Valid Values: "on"/"off"/"attack"/"defense"/"health". When active, you will automatically start training whenever you come back from a defeat. Default: Off.\n' +
                            '**Pronoun**: Valid values: "he"/"she"/"they". Determines what pronouns the game uses for messages about you. Default: They.');
                    break;
                case 'rank':
                    output.setTitle('Help: Player Ranks');
                    output.setDescription("Rank is determined by accumulating Glory. Glory is gained by winning battles, especially against foes stronger than yourself. As your Rank increases, you gain access to various new features.")
                        .addField('Rank Thresholds:', `\`\`\`\n
Rank C   50 Glory
Rank B   100 Glory
Rank A   150 Glory
Rank S   250 Glory
Rank S+  400 Glory
Rank S++ 700 Glory
Rank ??? 1000 Glory
\`\`\``);
                    break;
                case 'battle':
                    output.setTitle('Help: Battle')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!fight target', 'Challenge a player to a battle.')
                        .addField('!unfight', 'Cancel all outgoing battle challenges.')
                        .addField('!train type', 'Begin training to increase your power level. To focus on one stat, enter `!train attack/defense/health`.')
                        .addField('!tech', 'Use a battle technique. For more info, enter `!help tech`.')
                    break;
                case 'tech':
                    output.setTitle('Help: Techniques')
                        .setDescription("Whenever you train, there's a chance that you'll learn a new technique. To use them in battle, use the !tech or !t command, and you'll use it on your next turn." +
                            "\nBe careful: If you use any technique multiple times in the same fight, you'll probably regret it!")
                        .addField('Transform', 'Command: `!tech transform` or `!t t`. Restores some health, and increases attack and defense.')
                        .addField('Rage Mode', "Command: `!tech rage` or `!t r`. Greatly increases attack, but lowers defense. You'll also do an attack this turn.")
                        .addField('Burst Attack', "Command: `!tech burst` or `!t b`. Does a powerful attack. It can't crit, but it also can't miss or be blocked.")
                        .addField('Heal', 'Command: `!tech heal` or `!t h`. Recovers some of your lost health.')
                    break;
                    default:
                    if(this.addHelpField(output, topic)) {
                        return output;
                    } else {
                        output.addField('Available Help Topics', 'basic, info, battle, rank, tech');
                    }
                    break;
            }
        }

        return output;
    },
    addHelpField(embed, topic) {
        switch(topic.toLowerCase()) {
            case 'reg':
                embed.addField('!reg charactername', 'Registers a new player with the name "charactername".\n' +
                    'Requirements: Character name required. Must not have a character registered on this channel. Name must not contain spaces.');
                break;
            case 'check':
                embed.addField('!check', 'Displays info about your character - current power level, Glory, offers, and cooldowns. Usable by anyone.\n' +
                    'Requirements: Must be registered.');
                break;
            case 'scan':
                embed.addField('!scan target', 'Displays basic info about a character - current Power Level, training time. Usable by anyone.\n' +
                    'If the target is training, then it will estimate their power level, but the number may be wrong.\n' +
                    'Requirements: Must be registered.');
                break;
            case 'roster':
                embed.addField('!roster', 'Displays basic info about all - current Power Level, Rank, status. Usable by anyone.');
                break;
            case 'fight':
                embed.addField('!fight target', "Challenges another player to a fight! If the player has already challenged you, " +
                    "a battle will begin, and the loser will be taken out for a few hours. If you don't specify a target, then you'll deliver an open challenge to fight anyone in the channel.\n\n" +
                    "The battle will take place in an embed, with damage being dealt based on your attack and defense stats. If the winner suffered damage, they'll recover their health over time.\n" +
                    "Requirements: Must be registered. Target name must be a player in this channel. You and the target must both be alive. You can only be in one fight at a time.");
                break;
            case 'unfight':
                embed.addField('!unfight', "Cancels all your outgoing fight offers or taunts.\n" +
                    "Requirements: Must be registered. Must have challenged someone to a fight.");
                break;
            case 'train':
                embed.addField('!train', "Begin training! The longer you train, the stronger you'll be when you finish." +
                    " However, there's a certain degree of diminishing returns - after 16 hours, training gains slow down, " +
                    "and after 72 hours, training gains stop completely.\n" +
                    "You can specialize your training using one of these commands: `!train health` `!train attack` `!train defense`\n" +
                    "Requirements: Must be registered. Must be alive. Must have lost a battle since last time you trained.");
                break;
            case 'world':
                embed.addField('!world', "Displays basic info about the world - age, countdown timers, how many orbs are still in hiding. Can be used by anyone.");
                break;
            case 'scores':
                embed.addField('!score', "Displays the top ten greatest warriors of the previous season, sorted by Glory. Can be used by anyone, but only after the season ends.");
                break;
            default:
                return false;
        }
        return true;
    }
}