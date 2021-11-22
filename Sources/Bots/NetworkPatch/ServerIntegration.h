/* Copyright (c) 2021 Dreamy Cecil
This program is free software; you can redistribute it and/or modify
it under the terms of version 2 of the GNU General Public License as published by
the Free Software Foundation


This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

#pragma once

#include <Engine/Network/CommunicationInterface.h>
#include "StreamBlock.h"

// Create new packet
#define NEW_PACKET(_Var, _Type) MESSAGETYPE _Var##Type = MESSAGETYPE(_Type); CNetworkMessage _Var(_Var##Type)

// Return player index of a client
#define LOCAL_PLAYER_INDEX INDEX((_pNetwork->ga_aplsPlayers[0].pls_Active) ? _pNetwork->ga_aplsPlayers[0].pls_Index : -1)

void CECIL_AddBlockToAllSessions(CCecilStreamBlock &nsb);
