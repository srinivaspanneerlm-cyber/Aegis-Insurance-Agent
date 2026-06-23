import logging
import sys

# Define beautiful ANSI color codes for terminal display
class LogColors:
    NAVY = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    RESET = "\033[0m"
    BOLD = "\033[1m"

class AegisFormatter(logging.Formatter):
    """
    Sleek, high-fidelity log formatter inspired by premium fintech terminal outputs.
    """
    def format(self, record):
        # Choose icon based on log severity
        if record.levelno == logging.DEBUG:
            icon = f"{LogColors.CYAN}⚙{LogColors.RESET}"
        elif record.levelno == logging.INFO:
            icon = f"{LogColors.GREEN}✔{LogColors.RESET}"
        elif record.levelno == logging.WARNING:
            icon = f"{LogColors.YELLOW}⚠{LogColors.RESET}"
        elif record.levelno >= logging.ERROR:
            icon = f"{LogColors.RED}✘{LogColors.RESET}"
        else:
            icon = "•"

        timestamp = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        message = record.getMessage()
        
        # Colorize prefix based on log level
        if record.levelno >= logging.ERROR:
            msg_formatted = f"{LogColors.RED}{LogColors.BOLD}[ERROR]{LogColors.RESET}"
        elif record.levelno == logging.WARNING:
            msg_formatted = f"{LogColors.YELLOW}[WARN]{LogColors.RESET}"
        else:
            msg_formatted = f"{LogColors.NAVY}[AEGIS]{LogColors.RESET}"

        return f"{LogColors.BOLD}{timestamp}{LogColors.RESET} {icon} {msg_formatted} {message}"

def setup_logger(name: str = "aegis") -> logging.Logger:
    """
    Get or configure a logger instance with premium console outputs.
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers if already configured
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(AegisFormatter())
        logger.addHandler(console_handler)
        logger.propagate = False
        
    return logger

# Single globally imported logger instance
logger = setup_logger()
