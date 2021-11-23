#include "ConfigValue.h"

// Constructors
CConfigValue::CConfigValue(void) : CConfigElement(CET_VALUE) {
  cv_eType = CVT_INDEX;
  cv_iValue = 0;
  
  #ifdef DREAMY_JSON_GC
    ce_iGCIndex = _aConfigGarbage.Add(this);
    JSON_Print("[JSON GC]: Created CConfigValue (no type) at %d\n", ce_iGCIndex);
  #endif
};

CConfigValue::CConfigValue(const int &iValue) : CConfigElement(CET_VALUE) {
  SetValue(iValue);
  
  #ifdef DREAMY_JSON_GC
    ce_iGCIndex = _aConfigGarbage.Add(this);
    JSON_Print("[JSON GC]: Created CConfigValue (%s) at %d\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};
CConfigValue::CConfigValue(const float &fValue) : CConfigElement(CET_VALUE) {
  SetValue(fValue);
  
  #ifdef DREAMY_JSON_GC
    ce_iGCIndex = _aConfigGarbage.Add(this);
    JSON_Print("[JSON GC]: Created CConfigValue (%s) at %d\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};
CConfigValue::CConfigValue(const string &strValue) : CConfigElement(CET_VALUE) {
  SetValue(strValue);
  
  #ifdef DREAMY_JSON_GC
    ce_iGCIndex = _aConfigGarbage.Add(this);
    JSON_Print("[JSON GC]: Created CConfigValue (%s) at %d\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};
CConfigValue::CConfigValue(CConfigArray *caValue) : CConfigElement(CET_VALUE) {
  SetValue(caValue);
  
  #ifdef DREAMY_JSON_GC
    ce_iGCIndex = _aConfigGarbage.Add(this);
    JSON_Print("[JSON GC]: Created CConfigValue (%s) at %d\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};
CConfigValue::CConfigValue(CConfigBlock *cbValue) : CConfigElement(CET_VALUE) {
  SetValue(cbValue);
  
  #ifdef DREAMY_JSON_GC
    ce_iGCIndex = _aConfigGarbage.Add(this);
    JSON_Print("[JSON GC]: Created CConfigValue (%s) at %d\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};

// Set new value
void CConfigValue::SetValue(const int &iValue) {
  cv_eType = CVT_INDEX;
  cv_iValue = iValue;
  
  #ifdef DREAMY_JSON_GC
    JSON_Print("- Assigned %s type to CConfigValue at %d\n\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};

void CConfigValue::SetValue(const float &fValue) {
  cv_eType = CVT_FLOAT;
  cv_fValue = fValue;
  
  #ifdef DREAMY_JSON_GC
    JSON_Print("- Assigned %s type to CConfigValue at %d\n\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};

void CConfigValue::SetValue(const string &strValue) {
  cv_eType = CVT_STRING;
  strcpy(cv_strValue, strValue.c_str());
  
  #ifdef DREAMY_JSON_GC
    JSON_Print("- Assigned %s type to CConfigValue at %d\n\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};

void CConfigValue::SetValue(CConfigArray *caValue) {
  cv_eType = CVT_ARRAY;
  cv_caValue = caValue;
  
  #ifdef DREAMY_JSON_GC
    JSON_Print("- Assigned %s type to CConfigValue at %d\n\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};

void CConfigValue::SetValue(CConfigBlock *cbValue) {
  cv_eType = CVT_BLOCK;
  cv_cbValue = cbValue;
  
  #ifdef DREAMY_JSON_GC
    JSON_Print("- Assigned %s type to CConfigValue at %d\n\n", _astrConfigValueTypes[cv_eType], ce_iGCIndex);
  #endif
};

// Destructor
CConfigValue::~CConfigValue(void) {
  #ifdef DREAMY_JSON_GC
    JSON_Print("[JSON GC]: Deleting CConfigValue (%s): ", _astrConfigValueTypes[cv_eType]);
    
    switch (cv_eType) {
      case CVT_INDEX:
      case CVT_FLOAT:
      case CVT_STRING: {
        string strVal;
        PrintValue(strVal, 0, true);
        JSON_Print("%s\n", strVal.c_str());
      } break;
      case CVT_ARRAY: JSON_Print("<array>\n"); break;
      case CVT_BLOCK: JSON_Print("<block>\n"); break;
    }
    
    int iPos = _aConfigGarbage.FindIndex(this);
    if (iPos != -1) {
      JSON_Print("- Deleted CConfigValue at %d/%d\n", iPos, _aConfigGarbage.Count()-1);
      _aConfigGarbage.Delete(iPos);
    } else {
      JSON_Print("- Couldn't remove the reference from CConfigValue (%d/%d)\n", ce_iGCIndex, _aConfigGarbage.Count()-1);
    }
    JSON_Print("\n");
  #endif
  
  Clear();
};

void CConfigValue::Clear(void) {
  switch (cv_eType) {
    case CVT_ARRAY:
      delete cv_caValue;
      break;
      
    case CVT_BLOCK:
      delete cv_cbValue;
      break;
  }
};

// Print the value
void CConfigValue::PrintValue(string &strValue, const int &iLevel, bool bHasKey) {
  const int iKeyLevel = iLevel * !bHasKey;

  switch (cv_eType) {
    case CVT_INDEX: strValue = JSON_ConfigPrintF("%s%d", JSON_ConfigTabs(iKeyLevel).c_str(), cv_iValue); break;
    case CVT_FLOAT: strValue = JSON_ConfigPrintF("%s%f", JSON_ConfigTabs(iKeyLevel).c_str(), cv_fValue); break;

    case CVT_STRING:
      strValue = JSON_ConfigPrintF("%s\"%s\"", JSON_ConfigTabs(iKeyLevel).c_str(), cv_strValue);
      break;

    case CVT_ARRAY:
      cv_caValue->Print(strValue, iLevel);
      strValue = JSON_ConfigPrintF("%s%s", JSON_ConfigTabs(iKeyLevel).c_str(), strValue.c_str());
      break;
      
    case CVT_BLOCK:
      cv_cbValue->Print(strValue, iLevel);
      strValue = JSON_ConfigPrintF("%s%s", JSON_ConfigTabs(iKeyLevel).c_str(), strValue.c_str());
      break;
    
    default: strValue = "<error type>";
  }
};
