import { Router } from 'express'
import consolidatorTariffsRoutes from './consolidator-tariffs/consolidator-tariffs.routes'
import customsAgentTariffsRoutes from './customs-agent-tariffs/customs-agent-tariffs.routes'

const router = Router()

router.use('/consolidator-tariffs', consolidatorTariffsRoutes)
router.use('/customs-agent-tariffs', customsAgentTariffsRoutes)

export default router
