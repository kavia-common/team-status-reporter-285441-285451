#!/bin/bash
cd /home/kavia/workspace/code-generation/team-status-reporter-285441-285451/express_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

