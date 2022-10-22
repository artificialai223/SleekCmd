module.exports.register = async function (data) {
    const { Client, Collection, GatewayIntentBits } = require('discord.js')
    const Keyv = require('keyv');
    const fs = require('node:fs')
    const colors = require('colors')
    var appRoot = require('app-root-path');
    const { REST, Routes } = require('discord.js');

    if(data.hasOwnProperty('guild_id') == false) { console.log('Guild ID Missing.');process.exit() }
    if(data.hasOwnProperty('client_id') == false) { console.log('Client ID Missing.');process.exit() }
    if(data.hasOwnProperty('token') == false) { console.log('Token Missing.');process.exit() }
    if(data.hasOwnProperty('intents') == false) { console.log('Intents Missing.');process.exit() }
    
    
    // DB Init
    const keyv = new Keyv(data.db_driver || 'sqlite://'+appRoot+'/sleekcmd.sqlite');
    
    setup = false
    if(!fs.existsSync(appRoot+'/events')) {
        fs.mkdirSync(appRoot+'/events');
        setup = true
    }

    if(!fs.existsSync(appRoot+'/commands')) {
        fs.mkdirSync(appRoot+'/commands');
        

        fs.promises.writeFile(appRoot+'/commands/ping.js', `const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction) {
        await interaction.reply('Pong!');
    },
};`);

        setup = true
    }

    if(!fs.existsSync(appRoot+'/events/ready.js')) {
        
        fs.promises.writeFile(appRoot+'/events/ready.js', `const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        process.stdout.write(\`\\n\\n\\u001b[32;1mBot Online ✔\\u001b[0m\\n\\n\\u001b[34;1mBot Stats:\\u001b[0m\\n\\nGuilds: \\u001b[34;1m\${client.guilds.cache.size}\\u001b[0m\\nUsers: \\u001b[34;1m\${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}\\u001b[0m\\nChannels: \\u001b[34;1m\${client.channels.cache.size}\\u001b[0m\\n\\n\\u001b[34;1mProcess Stats:\\u001b[0m\\n\\nType: \\u001b[32;1mSleekCmd\\u001b[0m\\nIntents: \\u001b[35;1m\${client.intentlist.join(', ')}\\u001b[0m\\n\`);
    },
};`);

        setup = true
    }

    if(!fs.existsSync(appRoot+'/events/interactionCreate.js')) {
        
        fs.promises.writeFile(appRoot+'/events/interactionCreate.js', `const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        
        const command = interaction.client.commands.get(interaction.commandName);
        
        if (!command) {
            console.error(\`No command matching \${interaction.commandName} was found.\`);
            return;
        }
        
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(\`Error executing \${interaction.commandName}\`);
            console.error(error);
        }
    },
};`);

        setup = true
    }


    if(setup == true) { console.log(colors.brightGreen("✔")+" SleekCmd setup completed."); await new Promise(r => setTimeout(r, 1000)); console.log('\n\n') }

    let intents = [GatewayIntentBits.Guilds]
    for(const intent in data.intents) {
        if(data.intents[intent] == "Guilds") continue;

        intents.push(GatewayIntentBits[data.intents[intent]])
    }

    const client = new Client({ intents: intents });

    client.intentlist = data.intents
    client.commands = new Collection();
    client.db = keyv

    const commandFiles = fs.readdirSync(appRoot+'/commands').filter(file => file.endsWith('.js'));
    
    console.log(colors.brightBlue('Commands Loading'))
    for (const file of commandFiles) {
        const filePath = appRoot+'/commands/'+file
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`${command.data.name} | ${colors.brightGreen('✔')}`);
        } else {
            console.log(`${command.data.name} | ${colors.brightRed('✖')}  (Missing data or execute)`);
        }
    }

    console.log(colors.brightBlue('\nEvents Loading'))
    const eventsPath = appRoot+'/events'
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = eventsPath+'/'+file
        const event = require(filePath);
        if ('name' in event && 'execute' in event) {
            console.log(`${event.name || "Unknown"} | ${colors.brightGreen('✔')}`);
        } else {
            console.log(`${event.name || "Unknown"} | ${colors.brightRed('✖')}  (Missing name or execute)`);
            continue
        }

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }

    if(setup == true) {
        console.log(colors.brightBlue('\nDeploying Commands'))
        const commands = [];

        const commandFiles = fs.readdirSync(appRoot+'/commands').filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(appRoot+`/commands/${file}`);
        
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(command.data.name+" | "+colors.brightGreen('✔'))
            } else {
                console.log(command.data.name+" | "+colors.brightRed('✖')+"  (Missing execute or data)")
            }
        }
        
        
        const rest = new REST({ version: '10' }).setToken(data.token);
        
        console.log('\n')
        
        try {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(colors.brightGreen('Please wait | ')+colors.brightRed('⚠'));
        
            await rest.put(
                Routes.applicationGuildCommands(data.client_id, data.guild_id),
                { body: commands },
            );
        
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write('Commands deployed | '+colors.brightGreen('✔')+'\n');
        } catch (error) {
            console.log(colors.brightRed('⚠')+' Unable to deploy commands, exiting.')
        }
    }


    console.log(colors.brightBlue('\nStarting bot process\n'))
    client.login(data.token)
}