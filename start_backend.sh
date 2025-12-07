#!/bin/bash
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' 
clear
echo -e "${YELLOW}"
echo "      /^\/^\ "
echo "    _| O  O |_      FILTRIUM AI"
echo "   (==  T  ==)     Local Protection"
echo "    \   U  / "
echo "     \____/ "
echo -e "${NC}"
echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}      Filtrium - BACKEND (LINUX)  ${NC}"
echo -e "${BLUE}===================================================${NC}"
echo ""
echo -e "${YELLOW}[1/2] Checking for updates and installing libraries...${NC}"
echo "      (This might take a while if it's the first time)"
echo ""


pip3 install -r requirements.txt

echo ""
echo -e "${BLUE}[2/2] Starting the AI Server...${NC}"
echo ""
echo -e "${YELLOW}   STATUS: READY!${NC}"
echo "   PLEASE DO NOT CLOSE THIS TERMINAL."
echo "   You can minimize it while browsing."
echo ""
echo -e "${BLUE}===================================================${NC}"


python3 api.py


echo ""
read -p "Press Enter to exit..."