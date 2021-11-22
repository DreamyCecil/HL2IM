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

#include "StdH.h"
#include "ServerIntegration.h"

// Make 'for' construct for walking a list, keeping the iterator for later use
#define FOREACHINLISTKEEP(baseclass, member, head, iter) \
  LISTITER(baseclass, member) iter(head); \
  for (; !iter.IsPastEnd(); iter.MoveToNext())

// Constructor for receiving - uninitialized block
CCecilStreamBlock::CCecilStreamBlock(void) :
  CNetworkMessage(), nsb_iSequenceNumber(-1) {};

// Constructor for sending - empty packet with given type and sequence
CCecilStreamBlock::CCecilStreamBlock(INDEX iType, INDEX iSequenceNumber) :
  CNetworkMessage(MESSAGETYPE(iType)), nsb_iSequenceNumber(iSequenceNumber) {};

// Constructor for sending - copied packet with given sequence
CCecilStreamBlock::CCecilStreamBlock(CNetworkMessage &nmOther, INDEX iSequenceNumber) :
  CNetworkMessage(nmOther), nsb_iSequenceNumber(iSequenceNumber) {};

// Read a block from a received message
void CCecilStreamBlock::ReadFromMessage(CNetworkMessage &nmToRead) {
  // read sequence number from message
  nmToRead >> nsb_iSequenceNumber;
  
  // read the block as a submessage
  nmToRead.ExtractSubMessage(*this);
};

// Add a block to a message to send
void CCecilStreamBlock::WriteToMessage(CNetworkMessage &nmToWrite) {
  // write sequence number to message
  nmToWrite << nsb_iSequenceNumber;
  
  // write the block as a submessage
  nmToWrite.InsertSubMessage(*this);
};

// Remove the block from stream
void CCecilStreamBlock::RemoveFromStream(void) {
  nsb_lnInStream.Remove();
};

// Write the block into the file stream
void CCecilStreamBlock::Write_t(CTStream &strm) {
  // write sequence number
  strm << nsb_iSequenceNumber;
  
  // write block size
  strm << nm_slSize;
  
  // write block contents
  strm.Write_t(nm_pubMessage, nm_slSize);
};

// Read the block from the file stream
void CCecilStreamBlock::Read_t(CTStream &strm) {
  // read sequence number
  strm >> nsb_iSequenceNumber;
  
  // read block size
  strm >> nm_slSize;
  
  // read block contents
  strm.Read_t(nm_pubMessage, nm_slSize);
  
  // init the message read/write pointer
  nm_pubPointer = nm_pubMessage;
  nm_iBit = 0;
  
  // get the message type
  UBYTE ubType = 0;
  (*this) >> ubType;
  
  nm_mtType = (MESSAGETYPE)ubType;
};

// Add a block that is already allocated to the stream
void CCecilNetworkStream::AddAllocatedBlock(CCecilStreamBlock *pnsbBlock) {
  // search all blocks already in list
  FOREACHINLISTKEEP(CCecilStreamBlock, nsb_lnInStream, ns_lhBlocks, itnsbInList) {
    // if the block in list has same sequence as the one to add
    if (itnsbInList->nsb_iSequenceNumber == pnsbBlock->nsb_iSequenceNumber) {
      // just discard the new block
      delete pnsbBlock;
      return;
    }

    // if the block in list has lower sequence than the one to add
    if (itnsbInList->nsb_iSequenceNumber < pnsbBlock->nsb_iSequenceNumber) {
      // stop searching
      break;
    }
  }

  // add the new block before current one
  itnsbInList.InsertBeforeCurrent(pnsbBlock->nsb_lnInStream);
};

// Add a block to the stream
void CCecilNetworkStream::AddBlock(CCecilStreamBlock &nsbBlock) {
  // create a copy of the block
  CCecilStreamBlock *pnsbCopy = new CCecilStreamBlock(nsbBlock);

  // shrink it
  pnsbCopy->Shrink();

  // add it to the list
  AddAllocatedBlock(pnsbCopy);
};
