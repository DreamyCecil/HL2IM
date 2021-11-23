#include "ConfigArray.h"

// Constructor
CConfigArray::CConfigArray(void) : CConfigElement(CET_ARRAY) {
  #ifdef DREAMY_JSON_GC
    ce_iGCIndex = _aConfigGarbage.Add(this);
    JSON_Print("[JSON GC]: Created CConfigArray at %d\n", ce_iGCIndex);
  #endif
};

// Destructor
CConfigArray::~CConfigArray(void) {
  #ifdef DREAMY_JSON_GC
    JSON_Print("[JSON GC]: Deleting CConfigArray (%d elements):\n", Count());
    
    int iPos = _aConfigGarbage.FindIndex(this);
    if (iPos != -1) {
      JSON_Print("- Deleted CConfigArray at %d/%d\n", iPos, _aConfigGarbage.Count()-1);
      _aConfigGarbage.Delete(iPos);
    } else {
      JSON_Print("- Couldn't remove the reference from CConfigArray (%d/%d)\n", ce_iGCIndex, _aConfigGarbage.Count()-1);
    }
    JSON_Print("\n");
  #endif
  
  Clear();
};

// Clear the array
void CConfigArray::Clear(void) {
  if (ca_acvValues.Count() > 0) {
    for (int i = 0; i < ca_acvValues.Count(); i++) {
      delete ca_acvValues[i];
    }
  
    ca_acvValues.Clear();
  }
};

// Add values
int CConfigArray::AddValue(const int &iValue) {
  CConfigValue *cv = new CConfigValue(iValue);
  return ca_acvValues.Add(cv);
};

int CConfigArray::AddValue(const float &fValue) {
  CConfigValue *cv = new CConfigValue(fValue);
  return ca_acvValues.Add(cv);
};

int CConfigArray::AddValue(const string &strValue) {
  CConfigValue *cv = new CConfigValue(strValue);
  return ca_acvValues.Add(cv);
};

int CConfigArray::AddValue(CConfigArray *caArray) {
  CConfigValue *cv = new CConfigValue(caArray);
  return ca_acvValues.Add(cv);
};

int CConfigArray::AddValue(CConfigBlock *cbBlock) {
  CConfigValue *cv = new CConfigValue(cbBlock);
  return ca_acvValues.Add(cv);
};

int CConfigArray::AddValue(CConfigValue *cvValue) {
  return ca_acvValues.Add(cvValue);
};

// Print the array
void CConfigArray::Print(string &strPrint, const int &iLevel) {
  strPrint = "[]";
  
  if (ca_acvValues.Count() > 0) {
    strPrint = "[\n";

    for (int i = 0; i < ca_acvValues.Count(); i++) {
      CConfigValue *cv = ca_acvValues[i];
      
      string strValue = "";
      cv->PrintValue(strValue, iLevel+1, false);
      
      strPrint = JSON_ConfigPrintF("%s%s,\n", strPrint.c_str(), strValue.c_str());
    }
    strPrint = JSON_ConfigPrintF("%s%s]", strPrint.c_str(), JSON_ConfigTabs(iLevel).c_str());
  }
};
