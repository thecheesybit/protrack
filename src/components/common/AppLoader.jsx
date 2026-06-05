import { motion } from 'framer-motion'
import { AuroraBackground } from './AuroraBackground'

/** Full-screen boot loader shown while auth state resolves. */
export function AppLoader() {
  return (
    <motion.div
      key="loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col items-center justify-center gap-6"
    >
      <AuroraBackground />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        className="h-12 w-12 rounded-full border-2 border-line border-t-accent"
      />
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-sm font-medium tracking-wide text-muted"
      >
        Defying gravity…
      </motion.p>
    </motion.div>
  )
}
