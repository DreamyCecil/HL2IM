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

#include "DataList.h"

// Data map
MAP_TEMP class CCecilMap : public CCecilArray<cType> {
private:
  CCecilList<cKey> map_aKeys;

public:
  // Destructor
  ~CCecilMap(void) {
    Clear();
  };
  
  // Clear the map
  inline void Clear(void);

  // Add new key
  inline int Add(cKey mapKey);
  // Add new key and assign a value to it
  inline int Add(cKey mapKey, cType pObject);
  // Delete value under some key
  inline void Delete(cKey mapKey);

  // Find index of a specific key
  inline int FindKeyIndex(cKey mapKey);
  // Get the key under some index
  inline cKey &GetKey(int iValue);
  
  // Value access via the key
  inline cType &operator[](cKey mapKey);
  inline const cType &operator[](cKey mapKey) const;
  // Value access via the index
  inline cType &GetValue(int iValue);
  inline const cType &GetValue(int iValue) const;
  
  // Copy elements from the other map
  void CopyMap(const CCecilMap<cKey, cType> &mapOther);
  // Move elements from one map to this one
  void MoveMap(CCecilMap<cKey, cType> &mapOther);
  // Add elements from the other map and replace values of existing ones if needed
  void AddFrom(CCecilMap<cKey, cType> &mapOther, bool bReplace = false);

  // Assignment
  CCecilMap<cKey, cType> &operator=(const CCecilMap<cKey, cType> &mapOther);
};

#include "DataMap.inl"
