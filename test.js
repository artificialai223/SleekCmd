const config = require('./config.json')


// SleekCmd

const sleekcmd = require('./index')

sleekcmd.register({
    token: config.token,
    guild_id: "1028812204155355176",
    intents: ["Guilds", "GuildPresences"],
    client_id: "564510466421030946"
})