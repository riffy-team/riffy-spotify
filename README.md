## **About**
**Spotify** Plugin for Riffy Client.

## **Installation**
```
npm install riffy-spotify
```

## **Documentation**
- [Documentation](https://riffy.js.org)
- [Discord Server](https://discord.gg/TvjrWtEuyP)

## **Usage**
```js
const { Riffy } = require("riffy")
const { Spotify } = require("riffy-spotify")

const spotify = new Spotify({
    clientId: "XxxxXxxxXxxxX", // https://developer.spotify.com/
    clientSecret: "XxxxXxxxXxxxX"
});

client.riffy = new Riffy(client, nodes, {
    send: (payload) => {
        const guild = client.guilds.cache.get(payload.d.guild_id);
        if (guild) guild.shard.send(payload);
    },
    defaultSearchPlatform: "ytmsearch",
    restVersion: "v3",
    plugins: [spotify]
});
```

#### **Conclusion**
If you have any questions, feel free to join our [discord server](https://discord.gg/TvjrWtEuyP).

## **License**
This project is licensed under the [MIT License](./LICENSE)