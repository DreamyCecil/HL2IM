#ifndef SE_INCL_CRC_H
#define SE_INCL_CRC_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

extern ENGINE_API ULONG crc_aulCRCTable[256];

// begin crc calculation
inline void CRC_Start(ULONG &ulCRC) { ulCRC = 0xFFFFFFFF; };

// add data to a crc value
inline void CRC_AddBYTE( ULONG &ulCRC, UBYTE ub)
{
  ulCRC = (ulCRC>>8)^crc_aulCRCTable[UBYTE(ulCRC)^ub];
};

inline void CRC_AddWORD( ULONG &ulCRC, UBYTE uw)
{
  CRC_AddBYTE(ulCRC, UBYTE(uw>> 8));
  CRC_AddBYTE(ulCRC, UBYTE(uw>> 0));
};

inline void CRC_AddLONG( ULONG &ulCRC, ULONG ul)
{
  CRC_AddBYTE(ulCRC, UBYTE(ul>>24));
  CRC_AddBYTE(ulCRC, UBYTE(ul>>16));
  CRC_AddBYTE(ulCRC, UBYTE(ul>> 8));
  CRC_AddBYTE(ulCRC, UBYTE(ul>> 0));
};

inline void CRC_AddFLOAT(ULONG &ulCRC, FLOAT f)
{
  CRC_AddLONG(ulCRC, *(ULONG*)&f);
};

// add memory block to a CRC value
inline void CRC_AddBlock(ULONG &ulCRC, UBYTE *pubBlock, ULONG ulSize)
{
  for( INDEX i=0; i<ulSize; i++) CRC_AddBYTE( ulCRC, pubBlock[i]);
};

// end crc calculation
inline void CRC_Finish(ULONG &ulCRC) { ulCRC ^= 0xFFFFFFFF; };

#endif  /* include-once check. */

