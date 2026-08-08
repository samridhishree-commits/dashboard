import { ChannelWorkspace } from '../components/channel/ChannelWorkspace'
import type { Channel } from '../types'

export function ChannelPlaceholderPage({ channel }: { channel: Channel }) {
  return <ChannelWorkspace channel={channel} />
}
