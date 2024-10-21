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

#include "StdH.h"

#include "WriteStream.h"
#include <EntitiesMP/Cecil/ODE/ODEState.h>

CWriteStream::CWriteStream(CTStream *pSetStream, BOOL bSetText) {
  pstrm = pSetStream;
  bText = bSetText;
};

void CWriteStream::Write(const CTString &strKey, FLOAT f) {
  if (bText) {
    pstrm->FPrintF_t("%s : FLOAT( %g )\n", strKey.str_String, f);
  } else {
    *pstrm << f;
  }
};

void CWriteStream::Write(const CTString &strKey, DOUBLE f) {
  if (bText) {
    pstrm->FPrintF_t("%s : DOUBLE( %g )\n", strKey.str_String, f);
  } else {
    *pstrm << f;
  }
};

void CWriteStream::Write(const CTString &strKey, ULONG ul) {
  if (bText) {
    pstrm->FPrintF_t("%s : ULONG( %u )\n", strKey.str_String, ul);
  } else {
    *pstrm << ul;
  }
};

void CWriteStream::Write(const CTString &strKey, UWORD uw) {
  if (bText) {
    pstrm->FPrintF_t("%s : UWORD( %u )\n", strKey.str_String, uw);
  } else {
    *pstrm << uw;
  }
};

void CWriteStream::Write(const CTString &strKey, UBYTE ub) {
  if (bText) {
    pstrm->FPrintF_t("%s : UBYTE( %u )\n", strKey.str_String, ub);
  } else {
    *pstrm << ub;
  }
};

void CWriteStream::Write(const CTString &strKey, SLONG sl) {
  if (bText) {
    pstrm->FPrintF_t("%s : SLONG( %d )\n", strKey.str_String, sl);
  } else {
    *pstrm << sl;
  }
};

void CWriteStream::Write(const CTString &strKey, SWORD sw) {
  if (bText) {
    pstrm->FPrintF_t("%s : SWORD( %d )\n", strKey.str_String, sw);
  } else {
    *pstrm << sw;
  }
};

void CWriteStream::Write(const CTString &strKey, SBYTE sb) {
  if (bText) {
    pstrm->FPrintF_t("%s : SBYTE( %d )\n", strKey.str_String, sb);
  } else {
    *pstrm << sb;
  }
};

void CWriteStream::Write(const CTString &strKey, int i) {
  if (bText) {
    pstrm->FPrintF_t("%s : int( %d )\n", strKey.str_String, i);
  } else {
    *pstrm << i;
  }
};

void CWriteStream::WriteVector(const CTString &strKey, const dVector3 v) {
  if (bText) {
    pstrm->FPrintF_t("%s : vector( %g, %g, %g )\n", strKey.str_String, v[0], v[1], v[2]);
  } else {
    ::WriteVector(pstrm, v);
  }
};

void CWriteStream::WriteQuat(const CTString &strKey, const dQuaternion q) {
  if (bText) {
    pstrm->FPrintF_t("%s : quat( %g, %g, %g, %g )\n", strKey.str_String, q[0], q[1], q[2], q[3]);
  } else {
    ::WriteQuat(pstrm, q);
  }
};

void CWriteStream::WriteMatrix(const CTString &strKey, const dMatrix3 m) {
  if (bText) {
    pstrm->FPrintF_t("%s : matrix( %g, %g, %g, %g, %g, %g, %g, %g, %g, %g, %g, %g )\n", strKey.str_String,
      m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11]);

  } else {
    ::WriteMatrix(pstrm, m);
  }
};

void CWriteStream::WritePlace(const CTString &strKey, const CPlacement3D &pl) {
  if (bText) {
    pstrm->FPrintF_t("%s : placement( ( %g, %g, %g )  ( %g, %g, %g ) )\n", strKey.str_String,
      pl.pl_PositionVector(1), pl.pl_PositionVector(2), pl.pl_PositionVector(3),
      pl.pl_OrientationAngle(1), pl.pl_OrientationAngle(2), pl.pl_OrientationAngle(3));

  } else {
    *pstrm << pl;
  }
};

void CWriteStream::WriteID(const CChunkID &cid) {
  if (bText) {
    pstrm->FPrintF_t("---------- Chunk: [%s] ----------\n", cid.cid_ID);
  } else {
    pstrm->WriteID_t(cid);
  }
};

void CWriteStream::WriteData(const CTString &strKey, const void *pData, SLONG slSize) {
  if (bText) {
    pstrm->FPrintF_t("%s : custom_data_sizeof_%d(", strKey.str_String, slSize);

    for (SLONG i = 0; i < slSize; i++) {
      UBYTE *pByte = ((UBYTE *)pData) + i;
      pstrm->FPrintF_t(" %02X", *pByte);
    }

    pstrm->FPrintF_t(" )\n");

  } else {
    pstrm->Write_t(pData, slSize);
  }
};
