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

#include "DataArray.h"

// Data list
DS_TEMP class CCecilList : public CCecilArray<cType> {
public:
  // Add new element to the list
  inline int Add(cType pObject);
  // Insert new element somewhere in the list
  inline void Insert(const int &iPos, cType pObject);
  // Delete some element
  inline void Delete(const int &iPos);

  // Find index of a specific element
  int FindIndex(cType pObject);
};

#include "DataList.inl"
