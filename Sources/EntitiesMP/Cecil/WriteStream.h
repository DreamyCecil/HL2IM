/* Copyright (c) 2024 Dreamy Cecil
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

#ifndef CECIL_INCL_WRITESTREAM_H
#define CECIL_INCL_WRITESTREAM_H

#ifdef PRAGMA_ONCE
  #pragma once
#endif

// [Cecil] TEMP: A special serializer that can write data in both binary (normal) and text (for debugging)
class CWriteStream {
  public:
    CTStream *pstrm;
    BOOL bText;

    CWriteStream(CTStream *pSetStream, BOOL bSetText);

    void Write(const CTString &strKey, FLOAT f);
    void Write(const CTString &strKey, DOUBLE f);
    void Write(const CTString &strKey, ULONG ul);
    void Write(const CTString &strKey, UWORD uw);
    void Write(const CTString &strKey, UBYTE ub);
    void Write(const CTString &strKey, SLONG sl);
    void Write(const CTString &strKey, SWORD sw);
    void Write(const CTString &strKey, SBYTE sb);
    void Write(const CTString &strKey, int i);

    void WriteVector(const CTString &strKey, const dVector3 v);
    void WriteQuat(const CTString &strKey, const dQuaternion q);
    void WriteMatrix(const CTString &strKey, const dMatrix3 m);
    void WritePlace(const CTString &strKey, const CPlacement3D &pl);
    void WriteID(const CChunkID &cid);
    void WriteData(const CTString &strKey, const void *pData, SLONG slSize);
};

#define Write_key(_Value)       Write(#_Value, _Value)
#define WriteVector_key(_Value) WriteVector(#_Value, _Value)
#define WriteQuat_key(_Value)   WriteQuat(#_Value, _Value)
#define WriteMatrix_key(_Value) WriteMatrix(#_Value, _Value)

#endif
