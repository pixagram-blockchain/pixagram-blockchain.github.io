import React from 'preact/compat';
import TextField from "@material-ui/core/TextField";

import { t, useLanguage } from "../utils/text";

export const editorHeaderStyles = (theme) => ({
    editorHeader: {
        padding: theme.spacing(3, 3, 2, 3)
    },
    titleInput: {
        "& .MuiInputBase-root": {
            color: "#fff",
            fontSize: "2rem",
            fontWeight: 600,
            padding: 0,
            "&:before": { borderBottom: "none" },
            "&:hover:before": { borderBottom: "none" },
            "&:after": { borderBottom: "2px solid rgba(255,255,255,0.2)" }
        },
        "& .MuiInputBase-input": { padding: "8px 0" }
    },
    descriptionInput: {
        marginTop: 16,
        "& .MuiInputBase-root": {
            color: "#ccc",
            fontSize: "1rem",
            "&:before": { borderBottom: "none" },
            "&:hover:before": { borderBottom: "none" },
            "&:after": { borderBottom: "2px solid rgba(255,255,255,0.2)" }
        }
    },
});

const EditorHeader = React.memo(({ classes, title, description, onTitleChange, onDescriptionChange }) => {
    useLanguage();
    return (
    <div className={classes.editorHeader}>
        <TextField
            className={classes.titleInput}
            placeholder={t("components.editor_header.title")}
            value={title}
            onChange={onTitleChange}
            fullWidth
        />
        <TextField
            className={classes.descriptionInput}
            placeholder={t("components.editor_header.short_description")}
            value={description}
            onChange={onDescriptionChange}
            fullWidth
            multiline
            rows={2}
        />
    </div>
    );
});

export default EditorHeader;
