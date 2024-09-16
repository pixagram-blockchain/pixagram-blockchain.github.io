import * as React from "preact/compat";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";
import ExitToAppRounded from "@material-ui/icons/ExitToAppRounded";
import PersonAddRounded from "@material-ui/icons/PersonAddRounded";

import { t, useLanguage } from "../utils/text";

const ActionButtons = React.memo(({
                                      joined,
                                      onToggleJoined,
                                      onViewMembers,
                                      isMobile,
                                      actionButtonsClass,
                                      actionButtonsMobileClass
                                  }) => {
    // The custom comparator below only re-renders on joined/isMobile, so a
    // language swap would otherwise never reach these labels — useLanguage()
    // subscribes this component directly and forces the update itself.
    useLanguage();
    const className = isMobile ? actionButtonsMobileClass : actionButtonsClass;

    return (
        <div className={className}>
            <ButtonGroup variant="contained" size="small">
                <Tooltip title={joined ? t("components.action_buttons.leave_community") : t("components.action_buttons.join_community")}>
                    <Button onClick={onToggleJoined}>
                        {joined ? <ExitToAppRounded/> : <PersonAddRounded/>}
                    </Button>
                </Tooltip>
                <Button onClick={onViewMembers} >
                    {isMobile ? t("components.action_buttons.members") : t("components.action_buttons.view_members")}
                </Button>
            </ButtonGroup>
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.joined === nextProps.joined && prevProps.isMobile === nextProps.isMobile;
});

export default ActionButtons;