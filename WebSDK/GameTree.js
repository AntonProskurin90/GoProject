/**
 * Copyright 2014 the HtmlGoBoard project authors.
 * All rights reserved.
 * Project  WebSDK
 * Author   Ilya Kirillov
 * Date     17.11.14
 * Time     23:56
 */

var EDITINGFLAGS_MASK      = 0xFFFFFFFF; // 4 байта
var EDITINGFLAGS_NEWNODE   = 0x00000001; // Можно ли добавлять новую ноду, или ходить можно только по уже имеющимся.
var EDITINGFLAGS_MOVE      = 0x00000002; // Можно ли свободно передвигаться по нодам
var EDITINGFLAGS_BOARDMODE = 0x00000004; // Можно ли изменять тип редактирования на доске
var EDITINGFLAGS_LOADFILE  = 0x00000008; // Можно ли загружать файлы
var EDITINGFLAGS_GAMEINFO  = 0x00000010; // Можно ли редактировать информацию об игре

var EDITINGFLAGS_NEWNODE_NON   = EDITINGFLAGS_MASK ^ EDITINGFLAGS_NEWNODE;
var EDITINGFLAGS_MOVE_NON      = EDITINGFLAGS_MASK ^ EDITINGFLAGS_MOVE;
var EDITINGFLAGS_BOARDMODE_NON = EDITINGFLAGS_MASK ^ EDITINGFLAGS_BOARDMODE;
var EDITINGFLAGS_LOADFILE_NON  = EDITINGFLAGS_MASK ^ EDITINGFLAGS_LOADFILE;
var EDITINGFLAGS_GAMEINFO_NON  = EDITINGFLAGS_MASK ^ EDITINGFLAGS_GAMEINFO;

function CGameTree(Drawing)
{
    this.m_oSound            = new CBoardSound();
    this.m_oDrawing          = Drawing;

    this.m_oInterfaceState   = new CInterfaceState();

    this.m_oBoard            = new CLogicBoard();
    this.m_oDrawingBoard     = null;
    this.m_oDrawingNavigator = null;

    this.m_oFirstNode        = new CNode(this);   // Первая нода
    this.m_oCurNode          = this.m_oFirstNode; // Текущая нода

    this.m_nBlackCapt        = 0; // количество пленников черного игрока
    this.m_nWhiteCapt        = 0; // количество пленников белого игрока

    this.m_nNextMove         = BOARD_BLACK;

    this.m_nKomi             = 0;
    this.m_nHandicap         = 0;

    this.m_nBlackScores      = 0;
    this.m_nWhiteScores      = 0;

    this.m_nMovesCount       = 0; // Количество ходов (не путать с нодами!)
    this.m_nCurNodeDepth     = 0; // Глубина текущей ноды

    this.m_sApplication      = ""; // "AP"
    this.m_sCharset          = ""; // "CA"

    this.m_sGameAnnotator    = ""; // "AN"
    this.m_sBlackRating      = ""; // "BR"
    this.m_sBlackTeam        = ""; // "BT"
    this.m_sCopyright        = ""; // "CP"
    this.m_sDateTime         = ""; // "DT"
    this.m_sGameEvent        = ""; // "EV"
    this.m_sGameName         = ""; // "GN"
    this.m_sGameInfo         = ""; // "GC"
    this.m_sGameFuseki       = ""; // "ON"
    this.m_sOverTime         = ""; // "OT"
    this.m_sBlack            = "Black"; // "PB"
    this.m_sGamePlace        = ""; // "PC"
    this.m_sWhite            = "White"; // "PW"
    this.m_sResult           = ""; // "RE"
    this.m_sGameRound        = ""; // "RO"
    this.m_sRules            = ""; // "RU"
    this.m_sGameSource       = ""; // "SO"
    this.m_nTimeLimit        = 0;  // "TM"
    this.m_sGameTranscriber  = ""; // "US"
    this.m_sWhiteRating      = ""; // "WR"
    this.m_sWhiteTeam        = ""; // "WT"


    // TODO: В будушем надо будет добавить обработку элементов:
    //       "GN", "GC", "ON", "PC", "RO", "SO", "TM", "US", "WT"

    this.m_bEventEnable  = true;
    this.m_eShowVariants = EShowVariants.Next;

    this.m_nEditingFlags = 0xFFFFFFFF;

    this.m_nAutoPlayTimer   = null;
    this.m_dAutoPlaySpeed   = 0.75;
    this.m_nAutoPlayOldTime = -1;

    this.m_bTutorModeAuto      = false;
    this.m_nTutorMode          = BOARD_EMPTY;
    this.m_nTutorInterval      = 300;
    this.m_sTutorText          = "";
    this.m_nTutorId            = null;
    this.m_pTutorRightCallback = null;
    this.m_pTutorWrongCallback = null;
    this.m_pTutorResetCallback = null;
};
CGameTree.prototype.Copy_ForScoreEstimate = function()
{
    var oGameTree = new CGameTree();
    oGameTree.m_oBoard = this.m_oBoard.Copy();
    oGameTree.m_oFirstNode = this.m_oFirstNode.Copy_CurrentVariant(this.m_oCurNode);
    oGameTree.m_oCurNode   = oGameTree.m_oFirstNode;
    oGameTree.Step_ForwardToEnd();
    return oGameTree;
};
CGameTree.prototype.Set_TutorMode = function(bAuto, nMode, nInterval)
{
    if (true === bAuto)
    {
        this.m_bTutorModeAuto = true;
        this.m_nTutorMode     = BOARD_EMPTY;
    }
    else
    {
        this.m_bTutorModeAuto = false;
        this.m_nTutorMode     = nMode;
    }

    if (undefined !== nInterval)
        this.m_nTutorInterval = nInterval * 1000;
};
CGameTree.prototype.Set_TutorNewNodeText = function(sText)
{
    if (!sText || "" === sText)
        sText = "Wrong.\nOut of variants.";

    this.m_sTutorText = sText;
};
CGameTree.prototype.Set_TutorCallbacks = function(pRightCallBack, pWrongCallback, pResetCallback)
{
    this.m_pTutorRightCallback = pRightCallBack;
    this.m_pTutorWrongCallback = pWrongCallback;
    this.m_pTutorResetCallback = pResetCallback;
};
CGameTree.prototype.Start_AutoPlay = function()
{
    if (!(EDITINGFLAGS_MOVE & this.m_nEditingFlags))
        return;

    this.Stop_AutoPlay();

    if (this.m_oDrawing)
        this.m_oDrawing.On_StartAutoPlay();

    var oThis = this;

    var PlayingFunction = function()
    {
        if (oThis.Get_CurNode().Get_NextsCount() > 0)
        {
            oThis.Step_Forward(1);
        }

        if (oThis.Get_CurNode().Get_NextsCount() > 0)
        {
            oThis.m_nAutoPlayOldTime = new Date().getTime();
            oThis.m_nAutoPlayTimer = setTimeout(PlayingFunction, oThis.Get_AutoPlayInterval());
        }
        else
        {
            oThis.m_nAutoPlayTimer = null;

            if (oThis.m_oDrawing)
                oThis.m_oDrawing.On_StopAutoPlay();
        }
    };

    var CurTime = new Date().getTime();
    var CurInterval = CurTime - this.m_nAutoPlayOldTime;
    var AutoPlayInterval = this.Get_AutoPlayInterval();

    var NewInterval = AutoPlayInterval - CurInterval;

    if (NewInterval <= 0)
        PlayingFunction();
    else
        this.m_nAutoPlayTimer = setTimeout(PlayingFunction, NewInterval);
};
CGameTree.prototype.Get_AutoPlayInterval = function()
{
    var nMinInterval = 100;   // 0.1 секунды
    var nMaxInterval = 20000; // 20 секунд
    return nMinInterval + (nMaxInterval - nMinInterval) * (1 - this.m_dAutoPlaySpeed);
};
CGameTree.prototype.Stop_AutoPlay = function()
{
    if (this.m_oDrawing)
        this.m_oDrawing.On_StopAutoPlay();

    if (null !== this.m_nAutoPlayTimer)
    {
        clearTimeout(this.m_nAutoPlayTimer);
        this.m_nAutoPlayTimer = null;
    }
};
CGameTree.prototype.Set_AutoPlaySpeed = function(dSpeed)
{
    this.m_dAutoPlaySpeed = dSpeed;

    if (this.m_oDrawing)
        this.m_oDrawing.Update_AutoPlaySpeed(dSpeed);

    // Перестартовываем с новой скоростью, чтобы не ждать старый таймер.
    if (null !== this.m_nAutoPlayTimer)
    {
        this.Start_AutoPlay();
    }
};
CGameTree.prototype.GoTo_NodeByTimeLine = function(dPos)
{
    // Сначала посчитаем количество ходов в текущем варианте
    var MovesCount = this.private_GetMovesCountInCurVariant();

    var CurMove = dPos * (MovesCount - 1);

    var CurNode = this.m_oFirstNode;
    while (CurNode.Get_NextsCount() > 0 && CurMove > 0)
    {
        CurMove--;
        CurNode = CurNode.Get_Next();
    }

    this.GoTo_Node(CurNode);
};
CGameTree.prototype.private_GetTimeLinePos = function()
{
    var CurNode = this.m_oFirstNode;
    var Count = 1;
    var CurPos = 1;
    while (CurNode.Get_NextsCount() > 0)
    {
        Count++;
        CurNode = CurNode.Get_Next();

        if (CurNode === this.m_oCurNode)
            CurPos = Count;
    }

    if (Count > 0)
        return (CurPos - 1) / (Count - 1);

    return 1;
};
CGameTree.prototype.private_GetMovesCountInCurVariant = function()
{
    var CurNode = this.m_oFirstNode;
    var Count = 1;
    while (CurNode.Get_NextsCount() > 0)
    {
        Count++;
        CurNode = CurNode.Get_Next();
    }

    return Count;
};
CGameTree.prototype.On_EndLoadDrawing = function()
{
    if (this.m_oDrawingNavigator)
        this.m_oDrawingNavigator.Create_FromGameTree();

    if (this.m_oDrawing)
    {
        this.Update_InterfaceState();
        this.m_oDrawing.Update_AutoPlaySpeed(this.m_dAutoPlaySpeed);
    }
};
CGameTree.prototype.Set_DrawingNavigator = function(oDrawingNavigator)
{
    this.m_oDrawingNavigator = oDrawingNavigator;
};
CGameTree.prototype.Set_Drawing = function(oDrawing)
{
    this.m_oDrawing = oDrawing;
};
CGameTree.prototype.Update_Size = function()
{
    if (this.m_oDrawing)
        this.m_oDrawing.Update_Size();
};
CGameTree.prototype.Get_DrawingBoard = function()
{
    return this.m_oDrawingBoard;
};
CGameTree.prototype.Get_DrawingNavigator = function()
{
    return this.m_oDrawingNavigator;
};
CGameTree.prototype.Focus = function()
{
    if (this.m_oDrawingBoard)
        this.m_oDrawingBoard.Focus();
};
CGameTree.prototype.Load_Sgf = function(sFile, oViewPort)
{
    if (!(this.m_nEditingFlags & EDITINGFLAGS_LOADFILE))
        return;

    var oReader = new CSgfReader(this);
    var nEditingFlags = this.m_nEditingFlags;
    this.Reset_EditingFlags();
    oReader.Load(sFile);

    if (this.m_bTutorModeAuto)
        this.m_nTutorMode = this.Get_NextMove() === BOARD_BLACK ? BOARD_WHITE : BOARD_BLACK;

    var nSize = this.m_oBoard.Get_Size().X;
    if (this.m_oDrawingBoard && oViewPort)
    {
        if (true === oViewPort.Auto)
        {
            var X0 = (oReader.m_oViewPort.X0 <= 4 ? 0 : oReader.m_oViewPort.X0 - 2);
            var X1 = (nSize - oReader.m_oViewPort.X1 <= 3 ? nSize - 1 : oReader.m_oViewPort.X1);
            var Y0 = (oReader.m_oViewPort.Y0 <= 4 ? 0 : oReader.m_oViewPort.Y0 - 2);
            var Y1 = (nSize - oReader.m_oViewPort.Y1 <= 3 ? nSize - 1 : oReader.m_oViewPort.Y1);
            this.m_oDrawingBoard.Set_ViewPort(X0, Y0, X1, Y1);
        }
        else
            this.m_oDrawingBoard.Set_ViewPort(oViewPort.X0, oViewPort.Y0, oViewPort.X1, oViewPort.Y1);
    }
    else if (this.m_oDrawingBoard)
        this.m_oDrawingBoard.Set_ViewPort(0, 0, nSize - 1, nSize - 1);

    if (this.m_oDrawingNavigator)
    {
        this.m_oDrawingNavigator.Create_FromGameTree();
        this.m_oDrawingNavigator.Update();
    }

    this.GoTo_Node(this.m_oFirstNode);

    this.m_nEditingFlags = nEditingFlags;

    if (this.m_oDrawingBoard)
        this.m_oDrawingBoard.On_EndLoadSgf();

    if (this.m_oDrawing)
        this.m_oDrawing.Update_Size(true);
};
CGameTree.prototype.Set_DrawingBoard = function(DrawingBoard)
{
    this.m_oDrawingBoard = DrawingBoard;
};
CGameTree.prototype.Reset = function()
{
    this.m_oFirstNode    = new CNode(this);

    this.Set_GameName("");
    this.Set_Result("");
    this.Set_Rules("");
    this.Set_Komi(0);
    this.Set_Handicap("0");
    this.Set_TimeLimit("");
    this.Set_OverTime("");
    this.Set_Black("Black");
    this.Set_BlackRating("");
    this.Set_White("White");
    this.Set_WhiteRating("");
    this.Set_Copyright("");
    this.Set_GameInfo("");
    this.Set_DateTime("");
    this.Set_GameEvent("");
    this.Set_GameRound("");
    this.Set_GamePlace("");
    this.Set_GameAnnotator("");
    this.Set_GameFuseki("");
    this.Set_GameSource("");
    this.Set_GameTranscriber("");

    this.m_eShowVariants = EShowVariants.None;

    this.Init_Match();
};
CGameTree.prototype.Step_BackwardToStart = function()
{
    var nOldFlag = this.m_nEditingFlags;
    // Если у нас TutorMode, то даем перемещаться в начало, даже с запрещающим флагом перемещения
    if (BOARD_EMPTY !== this.m_nTutorMode)
    {
        this.Set_EditingFlags({Move : true});
    }

    this.GoTo_Node(this.m_oFirstNode);

    this.m_nEditingFlags = nOldFlag;

    if (BOARD_EMPTY !== this.m_nTutorMode)
    {
        if (this.m_pTutorResetCallback)
            this.m_pTutorResetCallback();
    }

};
CGameTree.prototype.Step_Backward = function(Count)
{
    var ParentNode = this.Get_CurNode();
    while (null != ParentNode.Get_Prev() && Count > 0)
    {
        ParentNode = ParentNode.Get_Prev();
        Count--;
    }

    this.GoTo_Node(ParentNode);
}
CGameTree.prototype.Step_Forward = function(Count)
{
    if (1 === Count)
    {
        if (!this.GoTo_Next())
            return;

        this.Execute_CurNodeCommands();
    }
    else
    {
        for (var Index = 0; Index < Count; Index++)
            this.GoTo_Next();

        this.GoTo_Node(this.Get_CurNode());
    }
};
CGameTree.prototype.Step_ForwardToEnd = function()
{
    while (this.GoTo_Next())
        ;

    this.GoTo_Node(this.Get_CurNode());
};
CGameTree.prototype.Pass = function()
{
    if (true === this.Add_NewNodeByPos(0, 0, this.m_nNextMove))
        this.Execute_CurNodeCommands();
};
CGameTree.prototype.GoTo_PrevVariant = function()
{
    var PrevNode = this.m_oCurNode.Get_Prev();
    if (null !== PrevNode)
    {
        // Ищем ветку с предыдущим вариантом
        var NextCur = PrevNode.Get_NextCur();
        if (PrevNode.Get_NextsCount() > 0 && NextCur > 0)
        {
            var Node = PrevNode.Get_Next(NextCur - 1);
            this.GoTo_Node(Node);
        }
    }
};
CGameTree.prototype.GoTo_NextVariant = function()
{
    var PrevNode = this.m_oCurNode.Get_Prev();
    if (null !== PrevNode)
    {
        // Ищем ветку со следующим вариантом
        var NextCur    = PrevNode.Get_NextCur();
        var NextsCount = PrevNode.Get_NextsCount();
        if (NextCur < NextsCount - 1)
        {
            var Node = PrevNode.Get_Next(NextCur + 1);
            this.GoTo_Node(Node);
        }
    }
};
CGameTree.prototype.GoTo_MainVariant = function()
{
    var CurNode = this.m_oCurNode;
    while (!CurNode.Is_OnMainVariant())
    {
        var PrevNode = CurNode.Get_Prev();

        // Такого не должно быть.
        if (null === PrevNode && CurNode !== this.m_oFirstNode)
            return;

        CurNode = PrevNode;
    }

    CurNode.GoTo_MainVariant();
    this.GoTo_Node(CurNode);
};
CGameTree.prototype.GoTo_NodeByXY = function(X, Y)
{
    if (this.m_oSound)
        this.m_oSound.Set_Silence( true );

    var CurNode = this.m_oCurNode;
    this.Step_BackwardToStart();

    var BreakCounter = 0;
    while (BreakCounter < 1000 && BOARD_EMPTY === this.m_oBoard.Get(X, Y))
    {
        this.Step_Forward(1);
        BreakCounter++;
    }

    // Если мы не нашли искомую ноду, тогда возвращаемся к начальной
    if (BOARD_EMPTY === this.m_oBoard.Get(X, Y))
        this.GoTo_Node(CurNode);

    if (this.m_oSound)
        this.m_oSound.Set_Silence( false );
};
CGameTree.prototype.Set_NextMove = function(Value)
{
    this.m_nNextMove = Value;
    this.m_oCurNode.Set_NextMove(Value);
};
CGameTree.prototype.Get_FirstNode = function()
{
    return this.m_oFirstNode;
};
CGameTree.prototype.Get_CurNode = function()
{
    return this.m_oCurNode;
};
CGameTree.prototype.Set_CurNode = function(oNode)
{
    return this.m_oCurNode = oNode;
};
CGameTree.prototype.Add_Move = function(X, Y, Value)
{
    this.m_oCurNode.Add_Move(X, Y, Value);
};
CGameTree.prototype.Add_NewNode = function(bUpdateNavigator, bSetCur)
{
    if (!(this.m_nEditingFlags & EDITINGFLAGS_NEWNODE))
        return false;

    var oNewNode = new CNode(this);
    oNewNode.Set_Prev(this.m_oCurNode);
    this.m_oCurNode.Add_Next(oNewNode, bSetCur);
    this.m_oCurNode = oNewNode;
    this.m_nCurNodeDepth++;

    if (true === bUpdateNavigator && this.m_oDrawingNavigator)
    {
        this.m_oDrawingNavigator.Create_FromGameTree();
        this.m_oDrawingNavigator.Update();
    }

    return true;
};
CGameTree.prototype.Add_NewNodeByPos = function(X, Y, Value)
{
    // Сначала проверим, есть ли у текущей ноды дочерняя нода с заданным значением.
    var Pos = Common_XYtoValue(X, Y);
    for (var Index = 0, NextsCount = this.m_oCurNode.Get_NextsCount(); Index < NextsCount; Index++)
    {
        var oNode = this.m_oCurNode.Get_Next( Index );
        var oMove = oNode.Get_Move();
        var nType = oMove.Get_Type();

        if (Pos === oMove.Get_Value() && (Value === nType && (BOARD_BLACK === Value || BOARD_WHITE === Value)))
        {
            var OldNextCur = this.m_oCurNode.Get_NextCur();

            this.m_oCurNode.Set_NextCur(Index);
            this.m_oCurNode = oNode;
            this.m_nCurNodeDepth++;

            if (this.m_oDrawingNavigator && OldNextCur !== Index)
                this.m_oDrawingNavigator.Update();

            return true;
        }
    }

    if (!(this.m_nEditingFlags & EDITINGFLAGS_NEWNODE))
        return false;

    // Если мы попали сюда, значит данного хода нет среди следующих у текущей ноды.
    this.Add_NewNode(false, true);
    this.m_oCurNode.Add_Move(X, Y, Value);

    if (this.m_oDrawingNavigator)
    {
        this.m_oDrawingNavigator.Create_FromGameTree();
        this.m_oDrawingNavigator.Update();
    }

    if (BOARD_EMPTY !== this.m_nTutorMode && "" !== this.m_sTutorText)
        this.m_oCurNode.Set_Comment(this.m_sTutorText);

    return true;
};
CGameTree.prototype.Add_MoveNumber = function(MoveNumber)
{
    this.m_oCurNode.Add_MoveNumber(MoveNumber);
};
CGameTree.prototype.AddOrRemove_Stones = function(Value, arrPos)
{
    this.m_oCurNode.AddOrRemove_Stones(Value, arrPos);
};
CGameTree.prototype.Add_Comment = function(sComment)
{
    var sOldComment = this.m_oCurNode.Get_Comment();
    this.m_oCurNode.Add_Comment(sComment);

    if (this.m_oDrawingNavigator && "" === sOldComment && "" !== sComment)
        this.m_oDrawingNavigator.Update();
};
CGameTree.prototype.Set_Comment = function(sComment)
{
    var sOldComment = this.m_oCurNode.Get_Comment();
    this.m_oCurNode.Set_Comment(sComment);

    if (this.m_oDrawingNavigator && (("" === sOldComment && "" !== sComment) || ("" !== sOldComment && "" === sComment)))
        this.m_oDrawingNavigator.Update();
};
CGameTree.prototype.Add_Mark = function(Type, arrPos)
{
    this.m_oCurNode.Add_Mark(Type, arrPos);
};
CGameTree.prototype.Remove_Mark = function(arrPos)
{
    this.m_oCurNode.Add_Mark(ECommand.RM, arrPos);
};
CGameTree.prototype.Add_TextMark = function(sText, Pos)
{
    this.m_oCurNode.Add_TextMark(sText, Pos);
};
CGameTree.prototype.Add_TerritoryPoint = function(Value, arrPos)
{
    if (!this.m_oCurNode.Is_TerritoryUse())
        this.m_oCurNode.Set_TerritoryUse(true);

    for (var Index = 0, Count = arrPos.length; Index < Count; Index++)
        this.m_oCurNode.Add_TerritoryPoint(arrPos[Index], Value);
};
CGameTree.prototype.Add_BlackTimeLeft = function(Time)
{
    this.m_oCurNode.Add_BlackTimeLeft(Time);
};
CGameTree.prototype.Add_WhiteTimeLeft = function(Time)
{
    this.m_oCurNode.Add_WhiteTimeLeft(Time);
};
CGameTree.prototype.Update_TerritoryMarks = function()
{
    if (!this.m_oCurNode.Is_TerritoryUse())
        this.m_oCurNode.Set_TerritoryUse(true);

    this.m_oCurNode.Fill_TerritoryFromLogicBoard(this.m_oBoard);
};
CGameTree.prototype.Clear_TerritoryPoints = function()
{
    if (true === this.m_oCurNode.Is_TerritoryUse())
    {
        this.m_oCurNode.Set_TerritoryUse(false);
        this.m_oCurNode.Clear_TerritoryPoints();
    }

    if (this.m_oDrawingBoard)
    {
        this.m_oDrawingBoard.Remove_AllMarks();
        this.m_oDrawingBoard.Draw_Marks();
    }
};
CGameTree.prototype.Remove_CurNode = function()
{
    var PrevNode = this.m_oCurNode.Get_Prev();

    // Первую ноду удалить нельзя, поэтому мы просто чистим её
    if (null === PrevNode)
    {
        this.m_oCurNode.Clear();

        // Перестраиваем визуальное дерево вариантов
        if (this.m_oDrawingNavigator)
        {
            this.m_oDrawingNavigator.Create_FromGameTree();
            this.m_oDrawingNavigator.Update();
        }

        this.GoTo_Node(this.m_oCurNode);

        return;
    }

    // Ищем позицию, в которой записана текующая нода у родительской
    for (var Index = 0, NextsCount = PrevNode.Get_NextsCount(); Index < NextsCount; Index++)
    {
        if (this.m_oCurNode === PrevNode.Get_Next(Index))
        {
            PrevNode.Remove_Next(Index);
            this.m_oCurNode = PrevNode;

            // Перестраиваем визуальное дерево вариантов
            if (this.m_oDrawingNavigator)
            {
                this.m_oDrawingNavigator.Create_FromGameTree();
                this.m_oDrawingNavigator.Update();
            }

            this.GoTo_Node(PrevNode);
            return;
        }
    }
};
CGameTree.prototype.Have_Move = function()
{
    return this.m_oCurNode.Have_Move();
};
CGameTree.prototype.Is_CurNodeLast = function()
{
    // Проверяем, последняя ли данная нода в варианте
    if (0 === this.m_oCurNode.Get_NextsCount())
        return true;

    return false;
};
CGameTree.prototype.Execute_CurNodeCommands = function()
{
    if (this.m_oDrawingBoard)
    {
        // При переходе к ноде отключаем подсчет очков, если он был включен
        if (EBoardMode.CountScores === this.m_oDrawingBoard.Get_Mode())
            this.m_oDrawingBoard.Set_Mode(EBoardMode.Move);

        // Очистим доску от отметок и комментариев предыдущей ноды
        this.m_oDrawingBoard.Remove_AllMarks();
        this.Show_Variants();
    }

    for (var CommandIndex = 0, CommandsCount = this.m_oCurNode.Get_CommandsCount(); CommandIndex < CommandsCount; CommandIndex++)
    {
        var Command = this.m_oCurNode.Get_Command( CommandIndex );
        var Command_Type  = Command.Get_Type();
        var Command_Value = Command.Get_Value();
        var Command_Count = Command.Get_Count();

        switch(Command_Type)
        {
            case ECommand.B:
            {
                var Pos = Common_ValuetoXY(Command_Value);
                this.Execute_Move(Pos.X, Pos.Y, BOARD_BLACK, false);
                break;
            }
            case ECommand.W:
            {
                var Pos = Common_ValuetoXY(Command_Value);
                this.Execute_Move(Pos.X, Pos.Y, BOARD_WHITE, false);
                break;
            }
            case ECommand.AB:
            {
                for (var Index = 0; Index < Command_Count; Index++ )
                {
                    var Pos = Common_ValuetoXY(Command_Value[Index]);
                    this.private_SetBoardPoint(Pos.X, Pos.Y, BOARD_BLACK, -1);
                }
                break;
            }
            case ECommand.AW:
            {
                for (var Index = 0; Index < Command_Count; Index++ )
                {
                    var Pos = Common_ValuetoXY(Command_Value[Index]);
                    this.private_SetBoardPoint(Pos.X, Pos.Y, BOARD_WHITE, -1);
                }
                break;
            }
            case ECommand.AE:
            {
                for (var Index = 0; Index < Command_Count; Index++ )
                {
                    var Pos = Common_ValuetoXY(Command_Value[Index]);
                    this.private_SetBoardPoint(Pos.X, Pos.Y, BOARD_EMPTY, -1);
                }
                break;
            }
            case ECommand.PL:
            {
                this.private_SetNextMove(Command_Value);
                break;
            }
            case ECommand.CR:
            {
                if (this.m_oDrawingBoard)
                {
                    for (var Index = 0; Index < Command_Count; Index++)
                    {
                        var Pos = Common_ValuetoXY(Command_Value[Index]);
                        this.m_oDrawingBoard.Add_Mark(new CDrawingMark(Pos.X, Pos.Y, EDrawingMark.Cr, ""));
                    }
                }
                break;
            }
            case ECommand.MA:
            {
                if (this.m_oDrawingBoard)
                {
                    for (var Index = 0; Index < Command_Count; Index++)
                    {
                        var Pos = Common_ValuetoXY(Command_Value[Index]);
                        this.m_oDrawingBoard.Add_Mark(new CDrawingMark(Pos.X, Pos.Y, EDrawingMark.X, ""));
                    }
                }
                break;
            }
            case ECommand.SQ:
            {
                if (this.m_oDrawingBoard)
                {
                    for (var Index = 0; Index < Command_Count; Index++)
                    {
                        var Pos = Common_ValuetoXY(Command_Value[Index]);
                        this.m_oDrawingBoard.Add_Mark(new CDrawingMark(Pos.X, Pos.Y, EDrawingMark.Sq, ""));
                    }
                }
                break;
            }
            case ECommand.TR:
            {
                if (this.m_oDrawingBoard)
                {
                    for (var Index = 0; Index < Command_Count; Index++)
                    {
                        var Pos = Common_ValuetoXY(Command_Value[Index]);
                        this.m_oDrawingBoard.Add_Mark(new CDrawingMark(Pos.X, Pos.Y, EDrawingMark.Tr, ""));
                    }
                }
                break;
            }
            case ECommand.LB:
            {
                if (this.m_oDrawingBoard)
                {
                    var Pos = Common_ValuetoXY(Command_Value.Pos);
                    this.m_oDrawingBoard.Add_Mark(new CDrawingMark(Pos.X, Pos.Y, EDrawingMark.Tx, Command_Value.Text));
                }
                break;
            }
            case ECommand.RM:
            {
                if (this.m_oDrawingBoard)
                {
                    for (var Index = 0; Index < Command_Count; Index++)
                    {
                        var Pos = Common_ValuetoXY(Command_Value[Index]);
                        this.m_oDrawingBoard.Remove_Mark(Pos.X, Pos.Y);
                    }
                }
                break;
            }
            case ECommand.BL:
            {
                if (false)
                    this.m_oDrawing.Update_BlackTime( Math.floor(Command_Value) );

                break;
            }
            case ECommand.WL:
            {
                if (false)
                    this.m_oDrawing.Update_WhiteTime( Math.floor(Command_Value) );
                break;
            }
        }
    }

    if (this.m_oDrawingBoard)
    {
        if (this.m_oCurNode.Have_Move())
        {
            var oMove = this.m_oCurNode.Get_Move();
            var X = oMove.Get_X();
            var Y = oMove.Get_Y();

            this.m_oDrawingBoard.Set_LastMoveMark(X, Y);
        }
        else
            this.m_oDrawingBoard.Set_LastMoveMark(-1, -1);

        if (this.m_oCurNode.Is_TerritoryUse())
            this.m_oDrawingBoard.Set_Mode(EBoardMode.CountScores);

        this.m_oDrawingBoard.Draw_Marks();
    }

    if (this.m_oDrawing)
    {
        var sComment = this.m_oCurNode.Get_Comment();

        var bNeedUpdateComment = true;
        if (BOARD_EMPTY !== this.m_nTutorMode)
        {
            if (this.m_oCurNode.Get_NextsCount() <= 0)
            {
                if (-1 !== sComment.indexOf("RIGHT") && null !== this.m_pTutorRightCallback)
                {
                    this.m_oDrawing.Update_Comments(sComment.replace("RIGHT", ""));
                    this.m_pTutorRightCallback();
                    bNeedUpdateComment = false;
                }
                else if (-1 === sComment.indexOf("RIGHT") && null !== this.m_pTutorWrongCallback)
                {
                    this.m_oDrawing.Update_Comments(sComment);
                    this.m_pTutorWrongCallback();
                    bNeedUpdateComment = false;
                }
            }

            if (bNeedUpdateComment)
                this.m_oDrawing.Update_Comments(sComment);
        }
        else
            this.m_oDrawing.Update_Comments(sComment);
    }

    if (this.m_oDrawingNavigator)
        this.m_oDrawingNavigator.Update_Current(true);

    this.Update_InterfaceState();

    if (this.m_nNextMove === this.m_nTutorMode)
    {
        if (null !== this.m_nTutorId)
            return;

        if (this.m_oCurNode.Get_NextsCount() >= 0)
        {
            var nOldFlags = this.m_nEditingFlags;
            var oThis = this;

            this.m_nTutorId = setTimeout(function()
            {
                oThis.Reset_EditingFlags();
                oThis.Step_Forward(1);
                oThis.m_nEditingFlags = nOldFlags;
                oThis.m_nTutorId = null;
            }, this.m_nTutorInterval);

            this.Forbid_All();
        }
    }
};
CGameTree.prototype.Execute_Move = function(X, Y, Value, bSilent)
{
    // Проверяем пасс
    if (0 == X && 0 == Y)
    {
        this.private_UpdateNextMove(Value);
        return;
    }

    // Поскольку, мы следуем спецификации SGF, тогда при выполнении хода:
    //  1. мы не проверяем, есть ли уже в данном месте камень
    //  2. Проверяем, убивает ли данный камень чужие камни(без учета ко)
    //  3. Если камень, не убивает чужие камни, тогда проверяем самоубийство
    //  4. Увеличиваем номер хода на 1

    if (this.m_oSound && true !== bSilent)
        this.m_oSound.Play_PlaceStone();

    this.private_SetBoardPoint(X, Y, Value, this.m_nMovesCount + 1, bSilent);

    // Проверяем, убиваем ли мы данным ходом чужие камни (без проверки правила КО)
    var oDeadChecker = null;
    if (null !== (oDeadChecker = this.m_oBoard.Check_Kill(X, Y, Value, false)) && oDeadChecker.Get_Size() > 0)
    {
        var nGroupSize = oDeadChecker.Get_Size();
        for (var Index = 0; Index < nGroupSize; Index++)
        {
            var Pos = Common_ValuetoXY(oDeadChecker.Get_Value(Index));
            this.private_SetBoardPoint(Pos.X, Pos.Y, BOARD_EMPTY, -1);
        }

        if (this.m_oSound && true !== bSilent)
            this.m_oSound.Play_CaptureStones(oDeadChecker.Get_Size());

        if (BOARD_BLACK === Value)
            this.m_nBlackCapt += nGroupSize;
        else
            this.m_nWhiteCapt += nGroupSize;
    }
    // Проверяем самоубийство
    else if (null !== (oDeadChecker = this.m_oBoard.Check_Dead(X, Y, Value, false)) && oDeadChecker.Get_Size() > 0)
    {
        var nGroupSize = oDeadChecker.Get_Size();
        for (var Index = 0; Index < nGroupSize; Index++)
        {
            var Pos = Common_ValuetoXY(oDeadChecker.Get_Value(Index));
            this.private_SetBoardPoint(Pos.X, Pos.Y, BOARD_EMPTY, -1);
        }

        if (this.m_oSound && true !== bSilent)
            this.m_oSound.Play_CaptureStones(oDeadChecker.Get_Size());

        if (BOARD_BLACK === Value)
            this.m_nWhiteCapt += nGroupSize;
        else
            this.m_nBlackCapt += nGroupSize;
    }
    else
    {
        // Обнуляем КО
        this.m_oBoard.Reset_Ko();
    }

    this.private_UpdateNextMove(Value);
};
CGameTree.prototype.GoTo_Next = function()
{
    if (!(this.m_nEditingFlags & EDITINGFLAGS_MOVE))
        return false;

    if (0 === this.m_oCurNode.Get_NextsCount() || -1 === this.m_oCurNode.Get_NextCur())
        return false;

    this.m_oCurNode = this.m_oCurNode.Get_Next(this.m_oCurNode.Get_NextCur());
    this.m_nCurNodeDepth++;

    return true;
};
CGameTree.prototype.Show_Variants = function()
{
    if (this.m_oDrawingBoard)
        this.m_oCurNode.Show_Variants(this.m_eShowVariants, this.m_oDrawingBoard);
};
CGameTree.prototype.Count_Scores = function()
{
    if (this.m_oDrawingBoard)
    {
        var Scores = this.m_oBoard.Count_Scores(this.m_oDrawingBoard);
        this.m_oDrawingBoard.Draw_Marks();
        this.Update_TerritoryMarks();

        this.m_nBlackScores = Scores.Black + this.m_nBlackCapt;
        this.m_nWhiteScores = Scores.White + this.m_nWhiteCapt + this.m_nKomi;

        this.Update_InterfaceState();
    }
};
CGameTree.prototype.Set_Sound = function(sPath)
{
    this.m_oSound.Init(sPath);
};
CGameTree.prototype.GoTo_Node = function(Node)
{
    if (!(this.m_nEditingFlags & EDITINGFLAGS_MOVE))
        return;

    this.Stop_AutoPlay();

    this.Init_Match();
    this.m_oBoard.Clear();

    // Временно отключаем звук, отрисовку камней и перемещение навигации
    if (this.m_oSound)
        this.m_oSound.Off();

    // Делаем вариант с данной нодой текущим
    var bUpdateNavigator = Node.Make_ThisNodeCurrent();

    this.m_oCurNode = this.m_oFirstNode;
    while (this.m_oCurNode != Node && this.m_oCurNode.Get_NextsCount() > 0)
    {
        // Выполняем на данной ноде только следующие команды:
        // ход (белых/черных), добавление/удаление камня.

        var CommandsCount = this.m_oCurNode.Get_CommandsCount();
        for ( var CommandIndex = 0; CommandIndex < CommandsCount; CommandIndex++ )
        {
            var Command = this.m_oCurNode.Get_Command( CommandIndex );
            var Command_Type  = Command.Get_Type();
            var Command_Value = Command.Get_Value();
            var Command_Count = Command.Get_Count();

            switch(Command_Type)
            {
                case ECommand.B:
                {
                    var Pos = Common_ValuetoXY(Command_Value);
                    this.Execute_Move(Pos.X, Pos.Y, BOARD_BLACK, true);
                    break;
                }
                case ECommand.W:
                {
                    var Pos = Common_ValuetoXY(Command_Value);
                    this.Execute_Move(Pos.X, Pos.Y, BOARD_WHITE, true);
                    break;
                }
                case ECommand.AB:
                {
                    for (var Index = 0; Index < Command_Count; Index++)
                    {
                        var Pos = Common_ValuetoXY(Command_Value[Index]);
                        this.m_oBoard.Set(Pos.X, Pos.Y, BOARD_BLACK, -1);
                    }
                    break;
                }
                case ECommand.AW:
                {
                    for (var Index = 0; Index < Command_Count; Index++)
                    {
                        var Pos = Common_ValuetoXY(Command_Value[Index]);
                        this.m_oBoard.Set(Pos.X, Pos.Y, BOARD_WHITE, -1);
                    }
                    break;
                }
                case ECommand.AE:
                {
                    for (var Index = 0; Index < Command_Count; Index++ )
                    {
                        var Pos = Common_ValuetoXY(Command_Value[Index]);
                        this.m_oBoard.Set(Pos.X, Pos.Y, BOARD_EMPTY, -1);
                    }
                    break;
                }
            }
        }

        if (!this.GoTo_Next())
            break;
    }

    // Отрисовываем текущую позицию
    if (this.m_oDrawingBoard)
        this.m_oDrawingBoard.Draw_AllStones();

    // У последней ноды выполняем команды в нормальном режиме
    this.Execute_CurNodeCommands();

    if (this.m_oDrawingNavigator && true === bUpdateNavigator)
        this.m_oDrawingNavigator.Update();

    // Включаем звук
    if (this.m_oSound)
        this.m_oSound.On();
};
CGameTree.prototype.Get_BlackName = function()
{
    return this.m_sBlack;
};
CGameTree.prototype.Get_BlackRating = function()
{
    return this.m_sBlackRating;
};
CGameTree.prototype.Get_WhiteName = function()
{
    return this.m_sWhite;
};
CGameTree.prototype.Get_WhiteRating = function()
{
    return this.m_sWhiteRating;
};
CGameTree.prototype.Get_Board = function()
{
    return this.m_oBoard;
};
CGameTree.prototype.Get_NextMove = function()
{
    return this.m_nNextMove;
};
CGameTree.prototype.Get_MovesCount = function()
{
    return this.m_nMovesCount;
};
CGameTree.prototype.Get_BlackCapt = function()
{
    return this.m_nBlackCapt;
};
CGameTree.prototype.Get_WhiteCapt = function()
{
    return this.m_nWhiteCapt;
};
CGameTree.prototype.Get_BlackScores = function()
{
    return this.m_nBlackScores;
};
CGameTree.prototype.Get_WhiteScores = function()
{
    return this.m_nWhiteScores;
};
CGameTree.prototype.Get_CurNodeDepth = function()
{
    return this.m_nCurNodeDepth;
};
CGameTree.prototype.Get_Komi = function()
{
    return this.m_nKomi;
};
CGameTree.prototype.Set_Komi = function(nKomi)
{
    this.m_nKomi = nKomi;
};
CGameTree.prototype.Get_Handicap = function()
{
    return this.m_nHandicap;
};
CGameTree.prototype.Set_Handicap = function(nHandicap)
{
    this.m_nHandicap = nHandicap;
};
CGameTree.prototype.Set_Application = function(sApp)
{
    this.m_sApplication = sApp;
};
CGameTree.prototype.Get_Application = function()
{
    return this.m_sApplication;
};
CGameTree.prototype.Set_Author = function(sAuthor)
{
    this.m_sAuthor = sAuthor;
};
CGameTree.prototype.Set_Charset = function(sCharset)
{
    this.m_sCharset = sCharset;
};
CGameTree.prototype.Get_Charset = function()
{
    return this.m_sCharset;
};
CGameTree.prototype.Set_ShowVariants = function(eType)
{
    if (eType !== this.m_eShowVariants)
    {
        this.m_eShowVariants = eType;
        this.Show_Variants();
    }
};
CGameTree.prototype.Get_ShowVariants = function()
{
    return this.m_eShowVariants;
};
CGameTree.prototype.Set_GameAnnotator = function(sAnnotator)
{
    this.m_sGameAnnotator = sAnnotator;
};
CGameTree.prototype.Get_GameAnnotator = function()
{
    return this.m_sGameAnnotator;
};
CGameTree.prototype.Set_BlackRating = function(sRating)
{
    this.m_sBlackRating = sRating;
    if (this.m_oDrawing)
        this.m_oDrawing.Update_BlackRank(this.m_sBlackRating);
};
CGameTree.prototype.Set_BlackTeam = function(sTeam)
{
    this.m_sBlackTeam = sTeam;
};
CGameTree.prototype.Get_BlackTeam = function()
{
    return this.m_sBlackTeam;
};
CGameTree.prototype.Set_Copyright = function(sCopyright)
{
    this.m_sCopyright = sCopyright;
};
CGameTree.prototype.Get_Copyright = function()
{
    return this.m_sCopyright;
};
CGameTree.prototype.Set_DateTime = function(sDateTime)
{
    this.m_sDateTime = sDateTime;
};
CGameTree.prototype.Get_DateTime = function()
{
    return this.m_sDateTime;
};
CGameTree.prototype.Set_GameEvent = function(sEvent)
{
    this.m_sGameEvent = sEvent;
};
CGameTree.prototype.Get_GameEvent = function()
{
    return this.m_sGameEvent;
};
CGameTree.prototype.Set_GameName = function(sGameName)
{
    this.m_sGameName = sGameName;
};
CGameTree.prototype.Get_GameName = function()
{
    return this.m_sGameName;
};
CGameTree.prototype.Set_GameInfo = function(sGameInfo)
{
    this.m_sGameInfo = sGameInfo;
};
CGameTree.prototype.Get_GameInfo = function()
{
    return this.m_sGameInfo;
};
CGameTree.prototype.Set_GameFuseki = function(sFuseki)
{
    this.m_sGameFuseki = sFuseki;
};
CGameTree.prototype.Get_GameFuseki = function()
{
    return this.m_sGameFuseki;
};
CGameTree.prototype.Set_OverTime = function(sOverTime)
{
    this.m_sOverTime = sOverTime;
};
CGameTree.prototype.Get_OverTime = function()
{
    return this.m_sOverTime;
};
CGameTree.prototype.Set_Black = function(sBlack)
{
    this.m_sBlack = sBlack;
    if (this.m_oDrawing)
        this.m_oDrawing.Update_BlackName(this.m_sBlack);
};
CGameTree.prototype.Set_GamePlace = function(sPlace)
{
    this.m_sGamePlace = sPlace;
};
CGameTree.prototype.Get_GamePlace = function()
{
    return this.m_sGamePlace;
};
CGameTree.prototype.Set_White = function(sWhite)
{
    this.m_sWhite = sWhite;
    if (this.m_oDrawing)
        this.m_oDrawing.Update_WhiteName(this.m_sWhite);
};
CGameTree.prototype.Set_Result = function(sResult)
{
    this.m_sResult = sResult;
};
CGameTree.prototype.Get_Result = function()
{
    return this.m_sResult;
};
CGameTree.prototype.Set_GameRound = function(sRound)
{
    this.m_sGameRound = sRound;
};
CGameTree.prototype.Get_GameRound = function()
{
    return this.m_sGameRound;
};
CGameTree.prototype.Set_Rules = function(sRules)
{
    this.m_sRules = sRules;
};
CGameTree.prototype.Get_Rules = function()
{
    return this.m_sRules;
};
CGameTree.prototype.Set_GameSource = function(sGameSource)
{
    this.m_sGameSource = sGameSource;
};
CGameTree.prototype.Get_GameSource = function()
{
    return this.m_sGameSource;
};
CGameTree.prototype.Set_TimeLimit = function(sTimeLimit)
{
    this.m_nTimeLimit = sTimeLimit;
};
CGameTree.prototype.Get_TimeLimit = function()
{
    return this.m_nTimeLimit;
};
CGameTree.prototype.Set_GameTranscriber = function(sTranscribber)
{
    this.m_sGameTranscriber = sTranscribber;
};
CGameTree.prototype.Get_GameTranscriber = function()
{
    return this.m_sGameTranscriber;
};
CGameTree.prototype.Set_WhiteRating = function(sWhiteRating)
{
    this.m_sWhiteRating = sWhiteRating;
    if (this.m_oDrawing)
        this.m_oDrawing.Update_WhiteRank(this.m_sWhiteRating);
};
CGameTree.prototype.Set_WhiteTeam = function(sWhiteTeam)
{
    this.m_sWhiteTeam = sWhiteTeam;
};
CGameTree.prototype.Set_BoardSize = function(W, H)
{
    // TODO: Пока мы работаем только с квадратными досками размера >= 2 (доска размером 1х1 бессмысленна)
    var W = Math.max(W, H, 2);
    var H = W;

    var OldSize = this.m_oBoard.Get_Size();

    if (W !== OldSize.X || H !== OldSize.Y)
    {
        this.m_oBoard.Reset_Size(W, H);

        if (this.m_oDrawingBoard)
            this.m_oDrawingBoard.On_Resize(true);
    }
};
CGameTree.prototype.Init_Match = function()
{
    this.m_oCurNode      = this.m_oFirstNode;
    this.m_nBlackCapt    = 0;
    this.m_nWhiteCapt    = 0;
    this.m_nMovesCount   = 0;
    this.m_nCurNodeDepth = 0;
    this.m_nNextMove     = BOARD_BLACK;
};
CGameTree.prototype.private_UpdateNextMove = function(CurMoveValue)
{
    if (BOARD_BLACK === CurMoveValue)
        this.private_SetNextMove(BOARD_WHITE);
    else
        this.private_SetNextMove(BOARD_BLACK);

    this.m_nMovesCount++;
};
CGameTree.prototype.private_SetBoardPoint = function(X, Y, Value, Num, bSilent)
{
    this.m_oBoard.Set(X, Y, Value, Num);

    if (this.m_oDrawingBoard && true !== bSilent)
        this.m_oDrawingBoard.Draw_Sector(X, Y, Value);
};
CGameTree.prototype.private_SetNextMove = function(Value)
{
    this.m_nNextMove = Value;
};
CGameTree.prototype.Update_InterfaceState = function()
{
    if (this.m_oDrawing)
    {
        var oIState = this.m_oInterfaceState;
        var PrevNode = this.m_oCurNode.Get_Prev();

        oIState.Backward = null === this.m_oCurNode.Get_Prev() ? false : true;
        oIState.Forward  = this.m_oCurNode.Get_NextsCount() <= 0 ? false : true;

        if (null !== PrevNode)
        {
            var PrevNextCur = PrevNode.Get_NextCur();
            var PrevNextsCount = PrevNode.Get_NextsCount();
            oIState.NextVariant = PrevNextCur < PrevNextsCount - 1 ? true : false;
            oIState.PrevVariant = PrevNextCur > 0 ? true : false;
        }
        else
        {
            oIState.NextVariant = false;
            oIState.PrevVariant = false;
        }

        if (this.m_oDrawingBoard)
            oIState.BoardMode = this.m_oDrawingBoard.Get_Mode();

        oIState.TimelinePos = this.private_GetTimeLinePos();

        this.m_oDrawing.Update_InterfaceState(oIState);

        if (this.m_oDrawingBoard && EBoardMode.CountScores === this.m_oDrawingBoard.Get_Mode())
            this.m_oDrawing.Update_Scores(this.Get_BlackScores(), this.Get_WhiteScores());
        else
            this.m_oDrawing.Update_Captured(this.Get_BlackCapt(), this.Get_WhiteCapt());
    }

};
CGameTree.prototype.Set_EditingFlags = function(oFlags)
{
    if (!oFlags)
        return;

    if (true === oFlags.NewNode)
        this.m_nEditingFlags |= EDITINGFLAGS_NEWNODE;
    else if (false === oFlags.NewNode)
        this.m_nEditingFlags &= EDITINGFLAGS_NEWNODE_NON;

    if (true === oFlags.Move)
        this.m_nEditingFlags |= EDITINGFLAGS_MOVE;
    else if (false === oFlags.Move)
        this.m_nEditingFlags &= EDITINGFLAGS_MOVE_NON;

    if (true === oFlags.ChangeBoardMode)
        this.m_nEditingFlags |= EDITINGFLAGS_BOARDMODE;
    else if (false === oFlags.ChangeBoardMode)
        this.m_nEditingFlags &= EDITINGFLAGS_BOARDMODE_NON;

    if (true === oFlags.LoadFile)
        this.m_nEditingFlags |= EDITINGFLAGS_LOADFILE;
    else if (false === oFlags.LoadFile)
        this.m_nEditingFlags &= EDITINGFLAGS_LOADFILE_NON;

    if (true === oFlags.GameInfo)
        this.m_nEditingFlags |= EDITINGFLAGS_GAMEINFO;
    else if (false === oFlags.GameInfo)
        this.m_nEditingFlags &= EDITINGFLAGS_GAMEINFO_NON;
};
CGameTree.prototype.Reset_EditingFlags = function()
{
    this.m_nEditingFlags = EDITINGFLAGS_MASK;
};
CGameTree.prototype.Forbid_All = function()
{
    this.m_nEditingFlags = 0;
};
CGameTree.prototype.Can_EditGameInfo = function()
{
    return (this.m_nEditingFlags & EDITINGFLAGS_GAMEINFO ? true : false);
};