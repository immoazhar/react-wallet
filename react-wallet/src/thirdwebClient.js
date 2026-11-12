import { createThirdwebClient } from 'thirdweb'

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID
if (!clientId) throw new Error('Missing VITE_THIRDWEB_CLIENT_ID')

export const thirdwebClient = createThirdwebClient({ clientId })
