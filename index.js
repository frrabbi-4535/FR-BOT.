import makeWASocket, { useSingleFileAuthState, Browsers } from "@whiskeysockets/baileys"
import ytdl from "ytdl-core"
import ytsr from "ytsr"

// ===== BOT INFO =====
const BOT_NAME = "FR BOT"
const OWNER_NAME = "FR RABBI"
const OWNER_NUMBER = "01761554035"

const { state, saveCreds } = useSingleFileAuthState("./auth.json")

async function startBot() {
  const sock = makeWASocket({
    printQRInTerminal: true,
    browser: Browsers.macOS(BOT_NAME),
    auth: state
  })

  sock.ev.on("creds.update", saveCreds)

  // Group participants update
  sock.ev.on("group-participants.update", async (u) => {
    const { id, participants, action } = u
    for (const p of participants) {
      const n = p.split("@")[0]
      if (action === "add") await sock.sendMessage(id, { text: `👋 Welcome @${n}`, mentions: [p] })
      if (action === "remove") await sock.sendMessage(id, { text: `👋 @${n} left the group`, mentions: [p] })
      if (action === "promote") await sock.sendMessage(id, { text: `🎉 Congrats @${n}, you are Admin now!`, mentions: [p] })
    }
  })

  // Messages handler
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""

    const meta = await sock.groupMetadata(from).catch(() => null)
    const user = msg.key.participant || msg.key.remoteJid
    const isAdmin = meta?.participants?.some(p => p.id === user && p.admin)

    // Commands
    if (text === ".menu") await sock.sendMessage(from, { text: `🤖 ${BOT_NAME} MENU\n.owner\n.all\n.song <name>\n.kick @user` })
    if (text === ".owner") await sock.sendMessage(from, { text: `👑 Owner: ${OWNER_NAME}\n📱 Number: ${OWNER_NUMBER}` })
    if (text === ".all") {
      if (!isAdmin) return sock.sendMessage(from, { text: "❌ Only admin can use this" })
      const users = meta.participants.map(p => p.id)
      await sock.sendMessage(from, { text: users.map(u => "@" + u.split("@")[0]).join(" "), mentions: users })
    }
    if (text.startsWith(".song ")) {
      const q = text.slice(6).trim()
      const res = await ytsr(q, { limit: 1 })
      const video = res.items.find(i => i.type === "video")
      if (!video) return sock.sendMessage(from, { text: "❌ Song not found" })
      const stream = ytdl(video.url, { filter: "audioonly" })
      await sock.sendMessage(from, { audio: { stream }, mimetype: "audio/mpeg" })
    }
    if (text.startsWith(".kick")) {
      if (!isAdmin) return sock.sendMessage(from, { text: "❌ Only admin can kick" })
      const tag = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
      if (!tag) return sock.sendMessage(from, { text: "❌ Mention someone" })
      await sock.groupParticipantsUpdate(from, tag, "remove")
    }
  })
}

startBot()
