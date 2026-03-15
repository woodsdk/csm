"""Background Scheduler — Runs the marketing engine periodically."""

import asyncio
import logging

logger = logging.getLogger(__name__)
_running = False


async def marketing_loop():
    """Background loop that runs trigger detection and step processing."""
    global _running
    _running = True
    logger.info("Marketing engine started (interval: 120s)")

    # Initial delay to let the app start up
    await asyncio.sleep(10)

    while _running:
        try:
            from .marketing_engine import detect_triggers, process_pending_steps
            detect_triggers()
            process_pending_steps()
        except Exception as e:
            logger.error(f"Marketing engine error: {e}")

        await asyncio.sleep(120)  # Run every 2 minutes


def start():
    """Start the marketing engine background task."""
    loop = asyncio.get_event_loop()
    loop.create_task(marketing_loop())
    logger.info("Marketing engine scheduler registered")


def stop():
    """Stop the marketing engine."""
    global _running
    _running = False
    logger.info("Marketing engine stopped")
