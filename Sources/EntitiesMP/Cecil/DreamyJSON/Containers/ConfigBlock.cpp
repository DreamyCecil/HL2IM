#include "ConfigBlock.h"

// Constructor
CConfigBlock::CConfigBlock(void) : CConfigElement(CET_BLOCK) {
  #ifdef DREAMY_JSON_GC
    ce_iGCIndex = _aConfigGarbage.Add(this);
    JSON_Print("[JSON GC]: Created CConfigBlock at %d\n", ce_iGCIndex);
  #endif
};

// Destructor
CConfigBlock::~CConfigBlock(void) {
  #ifdef DREAMY_JSON_GC
    JSON_Print("[JSON GC]: Deleting CConfigBlock (%d elements):\n", Count());
    
    int iPos = _aConfigGarbage.FindIndex(this);
    if (iPos != -1) {
      JSON_Print("- Deleted CConfigBlock at %d/%d\n", iPos, _aConfigGarbage.Count()-1);
      _aConfigGarbage.Delete(iPos);
    } else {
      JSON_Print("- Couldn't remove the reference from CConfigBlock (%d/%d)\n", ce_iGCIndex, _aConfigGarbage.Count()-1);
    }
    JSON_Print("\n");
  #endif
  
  Clear();
};

// Clear the block
void CConfigBlock::Clear(void) {
  if (cb_mapValues.Count() > 0) {
    for (int i = 0; i < cb_mapValues.Count(); i++) {
      delete cb_mapValues.GetValue(i);
    }
  
    cb_mapValues.Clear();
  }
};

// Print the block
void CConfigBlock::Print(string &strPrint, const int &iLevel) {
  strPrint = "{}";
  
  if (cb_mapValues.Count() > 0) {
    strPrint = "{\n";

    for (int i = 0; i < cb_mapValues.Count(); i++) {
      // add the key
      string strName = cb_mapValues.GetKey(i);
      CConfigValue *cv = cb_mapValues.GetValue(i);
      strPrint = JSON_ConfigPrintF("%s%s\"%s\" : ", strPrint.c_str(), JSON_ConfigTabs(iLevel+1).c_str(), strName.c_str());
      
      // add the value
      string strValue = "";
      cv->PrintValue(strValue, iLevel+1, true);
      
      strPrint = JSON_ConfigPrintF("%s%s,\n", strPrint.c_str(), strValue.c_str());
    }
    strPrint = JSON_ConfigPrintF("%s%s}", strPrint.c_str(), JSON_ConfigTabs(iLevel).c_str());
  }
};

// Add values
int CConfigBlock::AddValue(const string &strKey, const int &iValue) {
  CConfigValue *cv = new CConfigValue(iValue);
  return cb_mapValues.Add(strKey, cv);
};

int CConfigBlock::AddValue(const string &strKey, const float &fValue) {
  CConfigValue *cv = new CConfigValue(fValue);
  return cb_mapValues.Add(strKey, cv);
};

int CConfigBlock::AddValue(const string &strKey, const string &strValue) {
  CConfigValue *cv = new CConfigValue(strValue);
  return cb_mapValues.Add(strKey, cv);
};

int CConfigBlock::AddValue(const string &strKey, CConfigArray *caArray) {
  CConfigValue *cv = new CConfigValue(caArray);
  return cb_mapValues.Add(strKey, cv);
};

int CConfigBlock::AddValue(const string &strKey, CConfigBlock *cbBlock) {
  CConfigValue *cv = new CConfigValue(cbBlock);
  return cb_mapValues.Add(strKey, cv);
};

int CConfigBlock::AddValue(const string &strKey, CConfigValue *cvValue) {
  return cb_mapValues.Add(strKey, cvValue);
};

// Check types
int CConfigBlock::IsIndex(const string &strKey) {
  for (int iKey = 0; iKey < cb_mapValues.Count(); iKey++) {
    string strName = cb_mapValues.GetKey(iKey);
    CConfigValue *cv = cb_mapValues.GetValue(iKey);

    // wrong key name or not a number
    if (strName != strKey || cv->cv_eType != CVT_INDEX) {
      continue;
    }

    return iKey;
  }

  // couldn't find anything
  return -1;
};

int CConfigBlock::IsFloat(const string &strKey) {
  for (int iKey = 0; iKey < cb_mapValues.Count(); iKey++) {
    string strName = cb_mapValues.GetKey(iKey);
    CConfigValue *cv = cb_mapValues.GetValue(iKey);

    // wrong key name or not a number
    if (strName != strKey || cv->cv_eType != CVT_FLOAT) {
      continue;
    }

    return iKey;
  }

  // couldn't find anything
  return -1;
};

int CConfigBlock::IsString(const string &strKey) {
  for (int iKey = 0; iKey < cb_mapValues.Count(); iKey++) {
    string strName = cb_mapValues.GetKey(iKey);
    CConfigValue *cv = cb_mapValues.GetValue(iKey);

    // wrong key name or not a number
    if (strName != strKey || cv->cv_eType != CVT_STRING) {
      continue;
    }

    return iKey;
  }

  // couldn't find anything
  return -1;
};

int CConfigBlock::IsArray(const string &strKey) {
  for (int iKey = 0; iKey < cb_mapValues.Count(); iKey++) {
    string strName = cb_mapValues.GetKey(iKey);
    CConfigValue *cv = cb_mapValues.GetValue(iKey);

    // wrong key name or not a number
    if (strName != strKey || cv->cv_eType != CVT_ARRAY) {
      continue;
    }

    return iKey;
  }

  // couldn't find anything
  return -1;
};

int CConfigBlock::IsBlock(const string &strKey) {
  for (int iKey = 0; iKey < cb_mapValues.Count(); iKey++) {
    string strName = cb_mapValues.GetKey(iKey);
    CConfigValue *cv = cb_mapValues.GetValue(iKey);

    // wrong key name or not a number
    if (strName != strKey || cv->cv_eType != CVT_BLOCK) {
      continue;
    }

    return iKey;
  }

  // couldn't find anything
  return -1;
};

// Get values
bool CConfigBlock::GetValue(const string &strKey, int &iValue) {
  int iIndex = IsIndex(strKey);

  if (iIndex != -1) {
    iValue = cb_mapValues.GetValue(iIndex)->cv_iValue;
    return true;
  }

  return false;
};

bool CConfigBlock::GetValue(const string &strKey, float &fValue) {
  int iIndex = IsFloat(strKey);

  if (iIndex != -1) {
    fValue = cb_mapValues.GetValue(iIndex)->cv_fValue;
    return true;
  }

  return false;
};

bool CConfigBlock::GetValue(const string &strKey, string &strValue) {
  int iIndex = IsString(strKey);

  if (iIndex != -1) {
    strValue = cb_mapValues.GetValue(iIndex)->cv_strValue;
    return true;
  }

  return false;
};

bool CConfigBlock::GetValue(const string &strKey, CConfigArray *&caArray) {
  int iIndex = IsArray(strKey);

  if (iIndex != -1) {
    caArray = cb_mapValues.GetValue(iIndex)->cv_caValue;
    return true;
  }

  return false;
};

bool CConfigBlock::GetValue(const string &strKey, CConfigBlock *&cbValue) {
  int iIndex = IsBlock(strKey);

  if (iIndex != -1) {
    cbValue = cb_mapValues.GetValue(iIndex)->cv_cbValue;
    return true;
  }

  return false;
};
