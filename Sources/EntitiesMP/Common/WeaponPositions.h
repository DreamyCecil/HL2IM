 
#if 0 // use this part when manually setting weapon positions
//_pShell->DeclareSymbol("persistent user FLOAT wpn_fFZ[30+1];", &wpn_fFZ);
#else

#pragma warning(disable: 4305)

#define W_NONE 0
#define W_KNIFE 1
#define W_COLT 2
#define W_DCOLT 3
#define W_SS 4
#define W_DS 5
#define W_TGUN 6
#define W_MGUN 7
#define W_RL 8
#define W_GL 9
#define W_CSAW 10
#define W_FLAMER 11
#define W_LASER 12
#define W_SNIPER 13
#define W_CANNON 14
#define W_LAST 15

wpn_fH[W_NONE]=(FLOAT)0;
wpn_fP[W_NONE]=(FLOAT)0;
wpn_fB[W_NONE]=(FLOAT)0;
wpn_fX[W_NONE]=(FLOAT)0;
wpn_fY[W_NONE]=(FLOAT)0;
wpn_fZ[W_NONE]=(FLOAT)0;
wpn_fFOV[W_NONE]=(FLOAT)0;
wpn_fClip[W_NONE]=(FLOAT)0;
wpn_fFX[W_NONE]=(FLOAT)0;
wpn_fFY[W_NONE]=(FLOAT)0;

wpn_fH[W_KNIFE]=(FLOAT)-1;
wpn_fP[W_KNIFE]=(FLOAT)10;
wpn_fB[W_KNIFE]=(FLOAT)6;
wpn_fX[W_KNIFE]=(FLOAT)0.23;
wpn_fY[W_KNIFE]=(FLOAT)-0.28;
wpn_fZ[W_KNIFE]=(FLOAT)-0.44;
wpn_fFOV[W_KNIFE]=(FLOAT)41.5;
wpn_fClip[W_KNIFE]=(FLOAT)0.1;
wpn_fFX[W_KNIFE]=(FLOAT)0;
wpn_fFY[W_KNIFE]=(FLOAT)0;

wpn_fH[W_COLT]=(FLOAT)-1;
wpn_fP[W_COLT]=(FLOAT)0;
wpn_fB[W_COLT]=(FLOAT)0;
wpn_fX[W_COLT]=(FLOAT)0.19;
wpn_fY[W_COLT]=(FLOAT)-0.21;
wpn_fZ[W_COLT]=(FLOAT)-0.1;
wpn_fFOV[W_COLT]=(FLOAT)57;
wpn_fClip[W_COLT]=(FLOAT)0.1;
wpn_fFX[W_COLT]=(FLOAT)0;
wpn_fFY[W_COLT]=(FLOAT)0;

wpn_fH[W_DCOLT]=(FLOAT)-1;
wpn_fP[W_DCOLT]=(FLOAT)0;
wpn_fB[W_DCOLT]=(FLOAT)0;
wpn_fX[W_DCOLT]=(FLOAT)0.19;
wpn_fY[W_DCOLT]=(FLOAT)-0.21;
wpn_fZ[W_DCOLT]=(FLOAT)-0.1;
wpn_fFOV[W_DCOLT]=(FLOAT)57;
wpn_fClip[W_DCOLT]=(FLOAT)0.1;
wpn_fFX[W_DCOLT]=(FLOAT)0;
wpn_fFY[W_DCOLT]=(FLOAT)0;

wpn_fH[W_SS]=(FLOAT)2;
wpn_fP[W_SS]=(FLOAT)2;
wpn_fB[W_SS]=(FLOAT)0;
wpn_fX[W_SS]=(FLOAT)0.12;
wpn_fY[W_SS]=(FLOAT)-0.22;
wpn_fZ[W_SS]=(FLOAT)-0.34;
wpn_fFOV[W_SS]=(FLOAT)41;
wpn_fClip[W_SS]=(FLOAT)0.1;
wpn_fFX[W_SS]=(FLOAT)0;
wpn_fFY[W_SS]=(FLOAT)0;

wpn_fH[W_DS]=(FLOAT)2;
wpn_fP[W_DS]=(FLOAT)1;
wpn_fB[W_DS]=(FLOAT)0;
wpn_fX[W_DS]=(FLOAT)0.13;
wpn_fY[W_DS]=(FLOAT)-0.21;
wpn_fZ[W_DS]=(FLOAT)-0.364;
wpn_fFOV[W_DS]=(FLOAT)52.5;
wpn_fClip[W_DS]=(FLOAT)0.1;
wpn_fFX[W_DS]=(FLOAT)0;
wpn_fFY[W_DS]=(FLOAT)0;

wpn_fH[W_TGUN]=(FLOAT)4;
wpn_fP[W_TGUN]=(FLOAT)3;
wpn_fB[W_TGUN]=(FLOAT)0;
wpn_fX[W_TGUN]=(FLOAT)0.121;
wpn_fY[W_TGUN]=(FLOAT)-0.213;
wpn_fZ[W_TGUN]=(FLOAT)-0.285;
wpn_fFOV[W_TGUN]=(FLOAT)49;
wpn_fClip[W_TGUN]=(FLOAT)0.1;
wpn_fFX[W_TGUN]=(FLOAT)0;
wpn_fFY[W_TGUN]=(FLOAT)0;

wpn_fH[W_MGUN]=(FLOAT)2;
wpn_fP[W_MGUN]=(FLOAT)0;
wpn_fB[W_MGUN]=(FLOAT)0;
wpn_fX[W_MGUN]=(FLOAT)0.137;
wpn_fY[W_MGUN]=(FLOAT)-0.24;
wpn_fZ[W_MGUN]=(FLOAT)-0.328;
wpn_fFOV[W_MGUN]=(FLOAT)66.9;
wpn_fClip[W_MGUN]=(FLOAT)0.1;
wpn_fFX[W_MGUN]=(FLOAT)0;
wpn_fFY[W_MGUN]=(FLOAT)0;

wpn_fH[W_RL]=(FLOAT)2;
wpn_fP[W_RL]=(FLOAT)1;
wpn_fB[W_RL]=(FLOAT)0;
wpn_fX[W_RL]=(FLOAT)0.17;
wpn_fY[W_RL]=(FLOAT)-0.325;
wpn_fZ[W_RL]=(FLOAT)-0.24;
wpn_fFOV[W_RL]=(FLOAT)66;
wpn_fClip[W_RL]=(FLOAT)0.1;
wpn_fFX[W_RL]=(FLOAT)-0.1;
wpn_fFY[W_RL]=(FLOAT)0.11;

wpn_fH[W_GL]=(FLOAT)2;
wpn_fP[W_GL]=(FLOAT)6;
wpn_fB[W_GL]=(FLOAT)0;
wpn_fX[W_GL]=(FLOAT)0.14;
wpn_fY[W_GL]=(FLOAT)-0.41;
wpn_fZ[W_GL]=(FLOAT)-0.335001;
wpn_fFOV[W_GL]=(FLOAT)44.5;
wpn_fClip[W_GL]=(FLOAT)0.1;
wpn_fFX[W_GL]=(FLOAT)0;
wpn_fFY[W_GL]=(FLOAT)0;

wpn_fH[W_CSAW]=(FLOAT)5;
wpn_fP[W_CSAW]=(FLOAT)6;
wpn_fB[W_CSAW]=(FLOAT)-1;
wpn_fX[W_CSAW]=(FLOAT)0.125;
wpn_fY[W_CSAW]=(FLOAT)-0.29;
wpn_fZ[W_CSAW]=(FLOAT)-0.405;
wpn_fFOV[W_CSAW]=(FLOAT)73.5;
wpn_fClip[W_CSAW]=(FLOAT)0.1;
wpn_fFX[W_CSAW]=(FLOAT)0;
wpn_fFY[W_CSAW]=(FLOAT)0;

wpn_fH[W_FLAMER]=(FLOAT)4.6;
wpn_fP[W_FLAMER]=(FLOAT)2.8;
wpn_fB[W_FLAMER]=(FLOAT)0;
wpn_fX[W_FLAMER]=(FLOAT)0.204;
wpn_fY[W_FLAMER]=(FLOAT)-0.306;
wpn_fZ[W_FLAMER]=(FLOAT)-0.57;
wpn_fFOV[W_FLAMER]=(FLOAT)50;
wpn_fClip[W_FLAMER]=(FLOAT)0.1;
wpn_fFX[W_FLAMER]=(FLOAT)0.05;
wpn_fFY[W_FLAMER]=(FLOAT)0.03;

wpn_fH[W_LASER] = (FLOAT)1;
wpn_fP[W_LASER] = (FLOAT)3;
wpn_fB[W_LASER] = (FLOAT)0;
wpn_fX[W_LASER] = (FLOAT)0.141;
wpn_fY[W_LASER] = (FLOAT)-0.174;
wpn_fZ[W_LASER] = (FLOAT)-0.175;
wpn_fFOV[W_LASER] = (FLOAT)70.5;
wpn_fClip[W_LASER] = (FLOAT)0.1;
wpn_fFX[W_LASER] = (FLOAT)-0.1;
wpn_fFY[W_LASER] = (FLOAT)-0.4;

wpn_fH[W_SNIPER] = (FLOAT)4;
wpn_fP[W_SNIPER] = (FLOAT)2.5;
wpn_fB[W_SNIPER] = (FLOAT)-0.5;
wpn_fX[W_SNIPER] = (FLOAT)0.095;
wpn_fY[W_SNIPER] = (FLOAT)-0.26;
wpn_fZ[W_SNIPER] = (FLOAT)-0.85;
wpn_fFOV[W_SNIPER] = (FLOAT)23;
wpn_fClip[W_SNIPER] = (FLOAT)0.1;
wpn_fFX[W_SNIPER] = (FLOAT)0;
wpn_fFY[W_SNIPER] = (FLOAT)0;

wpn_fH[W_CANNON]=(FLOAT)2.5;
wpn_fP[W_CANNON]=(FLOAT)6;
wpn_fB[W_CANNON]=(FLOAT)0;
wpn_fX[W_CANNON]=(FLOAT)0.17;
wpn_fY[W_CANNON]=(FLOAT)-0.3;
wpn_fZ[W_CANNON]=(FLOAT)-0.625;
wpn_fFOV[W_CANNON]=(FLOAT)50;
wpn_fClip[W_CANNON]=(FLOAT)0.1;
wpn_fFX[W_CANNON]=(FLOAT)0.25;
wpn_fFY[W_CANNON]=(FLOAT)-0.5;

wpn_fH[W_LAST]=(FLOAT)0;
wpn_fP[W_LAST]=(FLOAT)0;
wpn_fB[W_LAST]=(FLOAT)0;
wpn_fX[W_LAST]=(FLOAT)0;
wpn_fY[W_LAST]=(FLOAT)0;
wpn_fZ[W_LAST]=(FLOAT)0;
wpn_fFOV[W_LAST]=(FLOAT)0;
wpn_fClip[W_LAST]=(FLOAT)0;
wpn_fFX[W_LAST]=(FLOAT)0;
wpn_fFY[W_LAST]=(FLOAT)0;

/*
_pShell->DeclareSymbol("user FLOAT wpn_fH[30+1];",    &wpn_fH);
_pShell->DeclareSymbol("user FLOAT wpn_fP[30+1];",    &wpn_fP);
_pShell->DeclareSymbol("user FLOAT wpn_fB[30+1];",    &wpn_fB);
_pShell->DeclareSymbol("user FLOAT wpn_fX[30+1];",    &wpn_fX);
_pShell->DeclareSymbol("user FLOAT wpn_fY[30+1];",    &wpn_fY);
_pShell->DeclareSymbol("user FLOAT wpn_fZ[30+1];",    &wpn_fZ);
_pShell->DeclareSymbol("user FLOAT wpn_fFOV[30+1];",  &wpn_fFOV);
_pShell->DeclareSymbol("user FLOAT wpn_fClip[30+1];", &wpn_fClip);
_pShell->DeclareSymbol("user FLOAT wpn_fFX[30+1];",   &wpn_fFX);
_pShell->DeclareSymbol("user FLOAT wpn_fFY[30+1];",   &wpn_fFY);
*/

#pragma warning(default: 4305)

#endif

