const ytdl = require('ytdl-core')
const Discord = require('discord.js')
const search = require('youtube-search')
const { List, Map } = require('immutable')
const { token, youtubeApiKey } = require('./config.json')

const client = new Discord.Client()
let activeChannels = Map()
let isPlaying = Map()
let shouldSkip = Map()
let connections = Map()

const searchOpts = {
  maxResults: 1,
  key: youtubeApiKey
}

const streamOptions = { seek: 0, volume: 1 }

setInterval(() => {
  connections.forEach((conn, channelId) => {
    if (shouldSkip.get(channelId)) {
      activeChannels.getIn([channelId, 0]).channel.send(`Skipping: \`${activeChannels.getIn([channelId, 0]).title}\``)
      activeChannels = activeChannels.set(channelId, activeChannels.get(channelId).filter(qObj => qObj.link !== activeChannels.getIn([channelId, 0]).link))
      isPlaying = isPlaying.delete(channelId)
      shouldSkip = shouldSkip.delete(channelId)
    }

    if (!isPlaying.get(channelId) && activeChannels.getIn([channelId, 0])) {
      console.log(`Playing: ${activeChannels.getIn([channelId, 0]).title}`)
      activeChannels.getIn([channelId, 0]).channel.send(`Playing: \`${activeChannels.getIn([channelId, 0]).title}\``)
      isPlaying = isPlaying.set(channelId, true)
      const dispatcher = conn.play(activeChannels.getIn([channelId, 0]).stream, streamOptions)
      dispatcher.on('finish', () => {
        activeChannels = activeChannels.set(channelId, activeChannels.get(channelId).filter(qObj => qObj.link !== activeChannels.getIn([channelId, 0]).link))
        isPlaying = isPlaying.delete(channelId)
      })
    }
  })
}, 100)

const addToQueue = ({ title, link }, channel) => {
  if (!activeChannels.get(channel.id)) {
    activeChannels = activeChannels.set(channel.id, List())
  }
  if (activeChannels.get(channel.id).size > 0) {
    channel.send(`Adding ${title} to the queue.`)
  }
  activeChannels = activeChannels.set(channel.id, activeChannels.get(channel.id).push({
    title,
    link,
    stream: ytdl(link, { filter : 'audioonly' }),
    channel
  }))
}

client.on('ready', () => {
  console.log('~~~~ready to play anime music~~~~')
})

client.on('message', message => {
  if (message.content.startsWith('-nc ')) {
    const searchThis = message.content.substr(4)
    if (searchThis === 'stop') {
      isPlaying = isPlaying.delete(message.channel.id)
      activeChannels = activeChannels.delete(message.channel.id)
      connections = connections.delete(message.channel.id)
      message.channel.send('bye!')
      message.member.voice.channel.leave()
      return
    }
    
    if (searchThis === 'skip') {
      shouldSkip = shouldSkip.set(message.channel.id, true)
      return
    }

    if (searchThis === 'queue') {
      if (activeChannels.get(message.channel.id) && activeChannels.get(message.channel.id).size > 0) {
        message.channel.send('Songs in the queue are:')
        activeChannels.get(message.channel.id).forEach((song, index) => {
          if (index === 0) {
            message.channel.send(`Playing: \`${song.title}\``)
          } else {
            message.channel.send(`${index}: \`${song.title}\``)
          }
        })
        activeChannels.get(message.channel.id)
      } else {
        message.channel.send('No queued songs.')
      }
      return
    }

    message.channel.send(`Searching for.. \`${searchThis}\` (NIGHTCORE)`)
    search(`${searchThis} nightcore`, searchOpts, function(err, results) {
      if (err) {
        return console.log(err)
      }

      if (!results[0].title.toLowerCase().includes('nightcore') && !results[0].title.toLowerCase().includes('night core')) {
        return
      }
      addToQueue(results[0], message.channel)
      
      var voiceChannel = message.member.voice.channel
      // if that bad boi aint up in the channel, join it
      voiceChannel.join().then(connection => {
        connections = connections.set(message.channel.id, connection)
      }).catch(err => console.log(err))
    })
  }
})

// Log our bot in
client.login(token)