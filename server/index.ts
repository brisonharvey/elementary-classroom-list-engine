import { createServer } from "./app"
import { getServerConfig } from "./config"

const config = getServerConfig()

createServer()
  .then((app) => app.listen({ port: config.port, host: config.host }))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
