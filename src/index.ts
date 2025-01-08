/* eslint-disable  @typescript-eslint/no-explicit-any */

import express, { Request, Response } from 'express'
import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = 3000

const CLIENT_ID = process.env.TWITCH_CLIENT_ID || ''
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || ''
let ACCESS_TOKEN = ''

interface TwitchUser {
  id: string;
  display_name: string;
  description: string;
  profile_image_url: string;
}

interface TwitchStream {
  title: string;
  game_name: string;
  thumbnail_url: string;
}

const getTwitchToken = async (): Promise<void> => {
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    })

    const data: any = await response.json()
    ACCESS_TOKEN = data.access_token
    console.log('Twitch Access Token acquired')
  } catch (error) {
    console.error('Error fetching Twitch token:', error)
  }
}

const getTwitchChannelInfo = async (
  username: string
): Promise<TwitchUser | null> => {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/users?login=${username}`,
      {
        headers: {
          'Client-ID': CLIENT_ID,
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    )

    const data: any = await response.json()
    console.log(data)
    return data.data.length ? data.data[0] : null
  } catch (error) {
    console.error('Error fetching Twitch channel info:', error)
    return null
  }
}

const getStreamStatus = async (userId: string): Promise<TwitchStream | null> => {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${userId}`,
      {
        headers: {
          'Client-ID': CLIENT_ID,
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    )

    const data: any = await response.json()
    return data.data.length ? data.data[0] : null
  } catch (error) {
    console.error('Error fetching stream status:', error)
    return null
  }
}

app.get('/:username', async (req: Request, res: Response): Promise<void> => {
  const username = req.params.username

  try {
    const channelInfo = await getTwitchChannelInfo(username)

    if (!channelInfo) {
      res.status(404).send('Channel not found')
      return
    }

    const streamInfo = await getStreamStatus(channelInfo.id)

    const userAgent = req.headers['user-agent'] || ''

    if (!userAgent.includes('DiscordBot')) {
      return res.redirect(`https://twitch.tv/${username}`)
    }

    const embedData = streamInfo
      ? {
        title: `${channelInfo.display_name} is 🔴 LIVE playing ${streamInfo.game_name}`,
        description: `${streamInfo.title}.`,
        image: streamInfo.thumbnail_url
          .replace('{width}', '1280')
          .replace('{height}', '720'),
        url: `https://twitch.tv/${username}`,
      }
      : {
        title: `${channelInfo.display_name} is offline`,
        description: `${channelInfo.description}`,
        image: channelInfo.profile_image_url,
        url: `https://twitch.tv/${username}`,
      }

    res.setHeader('Content-Type', 'text/html')
    res.send(`
      <meta name="og:site_name" content="Moons' TTV Embeds" />
      <meta property="theme-color" content="#6441a5" />
      <meta property="og:title" content="${embedData.title}" />
      <meta property="og:description" content="${embedData.description}" />
      <meta property="og:image" content="${embedData.image}" />
      <meta property="og:url" content="${embedData.url}" />
    `)
  } catch (error) {
    console.error(error)
    res.status(500).send('An error occurred')
  }
})

getTwitchToken().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
})
