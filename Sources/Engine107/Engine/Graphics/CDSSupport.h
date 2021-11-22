#pragma once

// CDS is an abbreviation for ChangeDisplaySettings
// this allows setting windows display settings (resolution/bitdepth/refreshrate)

// the CDS support should be initialized only once at application startup

// initialize CDS support (enumerate modes at startup)
void CDS_Init(void);
// end CDS support
void CDS_End(void);

// get list of all modes avaliable through CDS -- do not modify/free the returned list
CListHead &CDS_GetModes(void);

// set given display mode
BOOL CDS_SetMode(PIX pixSizeI, PIX pixSizeJ, enum DisplayDepth dd);
// reset windows to mode chosen by user within windows diplay properties
void CDS_ResetMode(void);
