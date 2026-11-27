# Project Architecture

- Keep the installable scanner as a manifest-only app launched at `/scanner`, with event selection before `/scan/:eventId`; avoid service workers unless offline use is explicitly requested, because this keeps preview behavior safe and scanning online-dependent.