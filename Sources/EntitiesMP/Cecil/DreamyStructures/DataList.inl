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

// Add new element to the list
DS_TEMP int CCecilList<cType>::Add(cType pObject) {
  int ctCount = this->ca_ctSize;
  this->Resize(ctCount+1);
  this->ca_aArray[ctCount] = pObject;

  return ctCount;
};

// Insert new element somewhere in the list
DS_TEMP void CCecilList<cType>::Insert(const int &iPos, cType pObject) {
  // Empty
  if (this->ca_ctSize <= 0) {
    this->New(iPos+1);
  
  // Copy elements
  } else {
    cType *aNew = new cType[this->ca_ctSize+1];

    for (int iOld = 0; iOld < this->ca_ctSize; iOld++) {
      // Shift to make space for a new element
      int iShift = (iOld >= iPos) ? 1 : 0;
      aNew[iOld+iShift] = this->ca_aArray[iOld];
    }

    delete[] this->ca_aArray;

    this->ca_ctSize++;
    this->ca_aArray = aNew;
  }

  this->ca_aArray[iPos] = pObject;
};

// Delete some element
DS_TEMP void CCecilList<cType>::Delete(const int &iPos) {
  // Position doesn't exist
  if (iPos >= this->ca_ctSize) {
    return;
  }

  // Just one object left
  if (this->ca_ctSize == 1) {
    this->Clear();
    return;
  }

  // Copy elements
  cType *aNew = new cType[this->ca_ctSize-1];

  for (int iOld = 0; iOld < this->ca_ctSize; iOld++) {
    // Skip the position
    if (iOld == iPos) {
      continue;
    }

    // Shift to make space for a new element
    int iShift = (iOld >= iPos);
    aNew[iOld-iShift] = this->ca_aArray[iOld];
  }

  delete[] this->ca_aArray;

  this->ca_ctSize--;
  this->ca_aArray = aNew;
};



// --- FUNCTIONS ---

// Find index of a specific element
DS_TEMP int CCecilList<cType>::FindIndex(cType pObject) {
  const int ctObjects = this->Count();

  for (int i = 0; i < ctObjects; i++) {
    if (this->ca_aArray[i] == pObject) {
      return i;
    }
  }
  return -1;
};
