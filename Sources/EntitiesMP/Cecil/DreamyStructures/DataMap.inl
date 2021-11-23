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

// --- INLINE ---

// Clear the map
MAP_TEMP void CCecilMap<cKey, cType>::Clear(void) {
  CCecilArray<cType>::Clear();
  map_aKeys.Clear();
};

// Add new key
MAP_TEMP int CCecilMap<cKey, cType>::Add(cKey mapKey) {
  int iNewKey = map_aKeys.Add(mapKey);
  this->Resize(iNewKey+1);

  return iNewKey;
};

// Add new key and assign a value to it
MAP_TEMP int CCecilMap<cKey, cType>::Add(cKey mapKey, cType pObject) {
  int iNewKey = this->Add(mapKey);
  this->ca_aArray[iNewKey] = pObject;

  return iNewKey;
};

// Delete value under some key
MAP_TEMP void CCecilMap<cKey, cType>::Delete(cKey mapKey) {
  int iKey = FindKeyIndex(mapKey);

  // Key doesn't exist
  if (iKey == -1) {
    return;
  }

  // Just one object left
  if (this->ca_ctSize == 1) {
    map_aKeys.Clear();
    Clear();
    return;
  }

  map_aKeys.Delete(iKey);

  // Copy elements
  cType *aNew = new cType[this->ca_ctSize-1];

  for (int iOld = 0; iOld < this->ca_ctSize; iOld++) {
    // Skip the position
    if (iOld == iKey) {
      continue;
    }

    // Shift to make space for a new element
    int iShift = (iOld >= iKey);
    aNew[iOld-iShift] = this->ca_aArray[iOld];
  }

  delete[] this->ca_aArray;

  this->ca_ctSize--;
  this->ca_aArray = aNew;
};

// Find index of a specific key
MAP_TEMP int CCecilMap<cKey, cType>::FindKeyIndex(cKey mapKey) {
  return map_aKeys.FindIndex(mapKey);
};

// Get the key under some index
MAP_TEMP cKey &CCecilMap<cKey, cType>::GetKey(int iValue) {
  return map_aKeys[iValue];
};

// Value access via the key
MAP_TEMP cType &CCecilMap<cKey, cType>::operator[](cKey mapKey) {
  int iKey = FindKeyIndex(mapKey);

  // Add a new key
  if (iKey == -1) {
    return this->ca_aArray[Add(mapKey)];
  }
  return this->ca_aArray[iKey];
};

MAP_TEMP const cType &CCecilMap<cKey, cType>::operator[](cKey mapKey) const {
  int iKey = FindKeyIndex(mapKey);
  return this->ca_aArray[iKey];
};

MAP_TEMP cType &CCecilMap<cKey, cType>::GetValue(int iValue) {
  return this->ca_aArray[iValue];
};

MAP_TEMP const cType &CCecilMap<cKey, cType>::GetValue(int iValue) const {
  return this->ca_aArray[iValue];
};



// --- FUNCTIONS ---
  
// Copy elements from the other map
MAP_TEMP void CCecilMap<cKey, cType>::CopyMap(const CCecilMap<cKey, cType> &mapOther) {
  map_aKeys.CopyArray(mapOther.map_aKeys);
  this->CopyArray(mapOther);
};

// Move elements from one map to this one
MAP_TEMP void CCecilMap<cKey, cType>::MoveMap(CCecilMap<cKey, cType> &mapOther) {
  map_aKeys.MoveArray(mapOther.map_aKeys);
  this->MoveArray(mapOther);
};

// Add elements from the other map
MAP_TEMP void CCecilMap<cKey, cType>::AddFrom(CCecilMap<cKey, cType> &mapOther, bool bReplace) {
  int ctAdd = mapOther.Count();

  // for each element
  for (int iAdd = 0; iAdd < ctAdd; iAdd++) {
    cKey pOtherKey = mapOther.GetKey(iAdd);
    cType pValue = mapOther.GetValue(iAdd);

    // if should be replaced
    if (bReplace) {
      int iKey = FindKeyIndex(pOtherKey);

      // change the value
      if (iKey != -1) {
        this->ca_aArray[iKey] = pValue;
        continue;
      }
    }

    // just add a new element
    Add(pOtherKey, pValue);
  }
};

// Assignment
MAP_TEMP CCecilMap<cKey, cType> &CCecilMap<cKey, cType>::operator=(const CCecilMap<cKey, cType> &mapOther) {
  if (this == &mapOther) {
    return *this;
  }

  CopyMap(mapOther);
  return *this;
};
