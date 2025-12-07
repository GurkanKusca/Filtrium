#!/bin/bash
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' 

echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}      Filtrium - BACKEND (LINUX)  ${NC}"
echo -e "${GREEN}===================================================${NC}"
echo ""
echo -e "${BLUE}[1/2] Checking for updates and installing libraries...${NC}"
echo "      (This might take a while if it's the first time)"
echo ""


pip3 install -r requirements.txt

echo ""
echo -e "${BLUE}[2/2] Starting the AI Server...${NC}"
echo ""
echo -e "${GREEN}   STATUS: READY!${NC}"
echo "   PLEASE DO NOT CLOSE THIS TERMINAL."
echo "   You can minimize it while browsing."
echo ""
echo -e "${GREEN}===================================================${NC}"


python3 api.py


echo ""
read -p "Press Enter to exit..."