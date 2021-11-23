/* Copyright (c) 2020 Dreamy Cecil
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

#include "DataTemplates.h"

// Data array
DS_TEMP class CCecilArray {
protected:
  int ca_ctSize;
  cType *ca_aArray;

public:
  // Constructors & Destructor
  inline CCecilArray(void);
  inline CCecilArray(const CCecilArray<cType> &aOriginal);
  inline ~CCecilArray(void);

  // Reset the array
  inline void Reset(void);
  // New array
  inline void New(int iCount);
  // Resize the array
  inline void Resize(int iNewCount);
  // Clear the array
  inline void Clear(void);

  // Get the element
  inline cType &operator[](int iObject);
  inline const cType &operator[](int iObject) const;

  // Count elements
  int Count(void);
  const int Count(void) const;
  // Element index in the array
  int Index(cType *pObject);

  // Copy elements from the other array
  void CopyArray(const CCecilArray<cType> &aOriginal);
  // Move elements from one array to this one
  void MoveArray(CCecilArray<cType> &aOther);

  // Assignment
  CCecilArray<cType> &operator=(const CCecilArray<cType> &aOther);
};

#include "DataArray.inl"
