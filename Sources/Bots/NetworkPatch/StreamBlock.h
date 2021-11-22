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

// A message block used for streaming data across network
class CCecilStreamBlock : public CNetworkMessage {
  public:
    CListNode nsb_lnInStream; // node in list of blocks in stream
    INDEX nsb_iSequenceNumber; // index for sorting in list

  public:
    // Constructor for receiving - uninitialized block
    CCecilStreamBlock(void);

    // Constructor for sending - empty packet with given type and sequence
    CCecilStreamBlock(INDEX iType, INDEX iSequenceNumber);

    // Constructor for sending - copied packet with given sequence
    CCecilStreamBlock(CNetworkMessage &nmOther, INDEX iSequenceNumber);

    // Read a block from a received message
    void ReadFromMessage(CNetworkMessage &nmToRead);

    // Add a block to a message to send
    void WriteToMessage(CNetworkMessage &nmToWrite);

    // Remove the block from stream
    void RemoveFromStream(void);

    // Write and read the block
    void Write_t(CTStream &strm);
    void Read_t(CTStream &strm);
};


// Stream of message blocks that can be sent across network
class CCecilNetworkStream {
  public:
    CListHead ns_lhBlocks; // list of blocks of this stream (higher sequences first)

    // Add a block that is already allocated to the stream
    void AddAllocatedBlock(CCecilStreamBlock *pnsbBlock);

  public:
    // Constructor
    CCecilNetworkStream(void);

    // Destructor
    ~CCecilNetworkStream(void);

    // Add a block to the stream (makes a copy of block)
    void AddBlock(CCecilStreamBlock &nsbBlock);
};
