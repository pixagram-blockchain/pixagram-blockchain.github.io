import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Autocomplete from '@material-ui/lab/Autocomplete';
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Avatar from "@material-ui/core/Avatar";
import CircularProgress from "@material-ui/core/CircularProgress";
import Radio from "@material-ui/core/Radio";
import RadioGroup from "@material-ui/core/RadioGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormControl from "@material-ui/core/FormControl";
import FormLabel from "@material-ui/core/FormLabel";
import Fade from "@material-ui/core/Fade";
import LinearProgress from "@material-ui/core/LinearProgress";
import * as actions from "../actions/utils";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    popper: {
        backgroundColor: "#242424ff !important"
    },
    darkGreyDialog: {
        backgroundColor: "#181818ff !important",
        "& .MuiButton-contained.Mui-disabled": {
            opacity: 0.35,
        }
    },
    progress: {
        margin: "16px 0px 16px 0px !important",
        "&.MuiLinearProgress-colorPrimary": {
            backgroundColor: "#222",
        },
        "& div.MuiLinearProgress-barColorPrimary": {
            backgroundColor: "#666"
        }
    },
    roleGroup: {
        marginTop: 16,
        "& .MuiFormLabel-root": {
            color: "#aaa",
            fontSize: "0.875rem",
            marginBottom: 4,
        },
        "& .MuiFormControlLabel-label": {
            color: "#ccc",
        },
        "& .MuiRadio-root": {
            color: "#666",
        },
        "& .MuiRadio-colorSecondary.Mui-checked": {
            color: "#c7c7c7",
        },
    },
});

// Hoisted static styles — were inline literals re-created per render.
const DESC_STYLE = { margin: "8px 0px 16px 0px" };
const PROGRESS_STYLE = { margin: "0px 0px 16px 0px" };
const OPTION_AVATAR_STYLE = { marginRight: 8, width: 32, height: 32, borderRadius: "8px" };
const OPTION_ROLE_STYLE = { color: "#888", fontWeight: "normal" };
const OPTION_NAME_STYLE = { fontSize: 12, color: "#888" };
const INPUT_AVATAR_STYLE = { width: 24, height: 24, marginRight: 6, borderRadius: "6px" };
const INPUT_AT_STYLE = { marginRight: -4, color: '#fff' };
const AUTOCOMPLETE_STYLE = { marginBottom: 8 };
const ALREADY_MEMBER_STYLE = { color: "#ffffff", fontSize: "0.8rem", marginTop: 4 };
const ACTIONS_STYLE = { textAlign: "right" };
const SHRINK_LABEL_PROPS = { shrink: true };

// Stable Autocomplete helpers — were arrow literals re-created per render.
const getAuthorOptionLabel = (option) => typeof option === 'string' ? option : option.username || '';
const identityFilter = (x) => x;

class AddSomeoneCommunityDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open || false,
            _username: "",
            _role: "mod",
            _authors: [],
            _selected_author: null,
            _searching: false,
            _broadcasting: false,
        };

        this._searchTimer = null;
        this._profileCache = {};
    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentWillUnmount() {
        if (this._searchTimer) clearTimeout(this._searchTimer);
    }

    componentWillReceiveProps(new_props) {
        // Reset on any open-state flip (open and close carried the same
        // duplicated reset block; merged — one spread instead of two).
        if (new_props.open !== this.state.open) {
            new_props = {
                ...new_props,
                _username: "",
                _role: "mod",
                _authors: [],
                _selected_author: null,
                _searching: false,
                _broadcasting: false,
            };
        }

        this.setState(new_props, () => {
            this.forceUpdate();
        });
    }

    // ── Account Search (same pattern as PixaWalletSendDialog) ───────

    _normalizeAuthor = (acc) => {
        if (!acc) return null;
        const username = acc.username || acc.name || '';
        if (!username) return null;

        if (this._profileCache[username]) return this._profileCache[username];

        const entry = {
            username,
            image: acc.image || (acc._profile && acc._profile.profile_image) || '',
            name: acc.display_name || (acc._profile && acc._profile.display_name) || username,
        };
        this._profileCache[username] = entry;
        return entry;
    };

    _onUsernameInputChange = (event, newInputValue) => {
        const input = (newInputValue || '').toLowerCase().replace(/^@/, '').trim();

        this.setState({ _username: input }, () => {
            this.forceUpdate();
        });

        if (this._searchTimer) clearTimeout(this._searchTimer);

        if (!input) {
            this.setState({ _authors: [], _searching: false, _selected_author: null }, () => {
                this.forceUpdate();
            });
            return;
        }

        if (this._profileCache[input]) {
            this.setState({ _selected_author: this._profileCache[input] });
        }

        this._searchTimer = setTimeout(() => {
            this._searchAccounts(input);
        }, 280);
    };

    _searchAccounts = async (input) => {
        const api = this.props.api;
        if (!api) return;

        this.setState({ _searching: true }, () => { this.forceUpdate(); });

        try {
            const names = await api.accounts.lookupAccounts(input, 7);
            if (!Array.isArray(names) || names.length === 0) {
                this.setState({ _authors: [], _searching: false, _selected_author: null }, () => {
                    this.forceUpdate();
                });
                return;
            }

            const accounts = await api.accounts.getAccounts(names);
            const authors = (accounts || [])
                .map(a => this._normalizeAuthor(a))
                .filter(Boolean);

            const currentInput = this.state._username;
            const exactMatch = authors.find(a => a.username === currentInput) || null;

            this.setState({
                _authors: authors,
                _searching: false,
                _selected_author: exactMatch || this.state._selected_author,
            }, () => {
                this.forceUpdate();
            });
        } catch (e) {
            console.warn('[AddSomeoneCommunityDialog] _searchAccounts error:', e);
            this.setState({ _searching: false }, () => { this.forceUpdate(); });
        }
    };

    _onAutocompleteChange = (event, value) => {
        if (value && typeof value === 'object' && value.username) {
            this.setState({
                _username: value.username,
                _selected_author: value,
            }, () => { this.forceUpdate(); });
        } else if (typeof value === 'string') {
            const resolved = this._profileCache[value] || null;
            this.setState({
                _username: value,
                _selected_author: resolved,
            }, () => {
                this.forceUpdate();
                if (!resolved && value.length > 0) {
                    this._resolveUsername(value);
                }
            });
        }
    };

    _resolveUsername = async (username) => {
        const api = this.props.api;
        if (!api || !username) return;

        try {
            const accounts = await api.accounts.getAccounts([username]);
            if (accounts && accounts[0]) {
                const author = this._normalizeAuthor(accounts[0]);
                if (author && author.username === this.state._username) {
                    this.setState({ _selected_author: author }, () => { this.forceUpdate(); });
                }
            }
        } catch (e) { /* ignore */ }
    };

    _handleRoleChange = (event) => {
        this.setState({ _role: event.target.value }, () => {
            this.forceUpdate();
        });
    };

    _handleConfirm = async () => {
        const { _username, _role } = this.state;
        const { api, communityName } = this.props;

        if (!api || !communityName || !_username || !_role) return;

        this.setState({ _broadcasting: true }, () => {
            this.forceUpdate();
        });

        try {
            await api.communities.setRole(communityName, _username, _role);

            actions.trigger_snackbar(t("components.add_someone_community_dialog.has_been_added_as", {
                _username: _username,
                _role: _role
            }));

            if (typeof this.props.onSave === 'function') {
                this.props.onSave();
            } else if (typeof this.props.onClose === 'function') {
                this.props.onClose();
            }
        } catch (err) {
            console.error('[AddSomeoneCommunityDialog] setRole failed:', err);
            actions.trigger_snackbar(err.message || 'Failed to set role');

            this.setState({ _broadcasting: false }, () => {
                this.forceUpdate();
            });

            if (typeof this.props.onClose === 'function') {
                this.props.onClose();
            }
        }
    };

    /**
     * Check if a username is already part of the team.
     */
    _isTeamMember = (username) => {
        const members = this.props.members || [];
        return members.some(m => m.username === username);
    };

    _getOptionDisabled = (option) => option && this._isTeamMember(option.username);

    // Stable render props (read live state/props at call time) — were inline
    // closures re-allocated on every render of the dialog.
    _renderOption = (option) => {
        const members = this.props.members || [];
        const isMember = this._isTeamMember(option.username);
        const existingRole = isMember
            ? (members.find(m => m.username === option.username) || {}).role || ''
            : '';
        return (
            <div style={{ display: "flex", alignItems: "center", opacity: isMember ? 0.4 : 1 }}>
                <Avatar
                    src={option.image}
                    alt={option.username}
                    style={OPTION_AVATAR_STYLE}
                    className={"pixelated"}
                />
                <div>
                    <strong>@{option.username}</strong>
                    {isMember
                        ? <span style={OPTION_ROLE_STYLE}> ({existingRole})</span>
                        : null}
                    <div style={OPTION_NAME_STYLE}>{option.name}</div>
                </div>
            </div>
        );
    };

    _renderInput = (params) => {
        const { _username, _selected_author, _searching } = this.state;
        const resolvedImage = (_selected_author && _selected_author.username === _username)
            ? _selected_author.image
            : '';
        return (
            <TextField
                {...params}
                label={t("words.username")}
                variant="filled"
                fullWidth
                InputLabelProps={SHRINK_LABEL_PROPS}
                InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                        <React.Fragment>
                            <Avatar
                                src={resolvedImage}
                                style={INPUT_AVATAR_STYLE}
                                className={"pixelated"}
                            />
                            <span style={INPUT_AT_STYLE}>@</span>
                            {params.InputProps.startAdornment}
                        </React.Fragment>
                    ),
                    endAdornment: (
                        <React.Fragment>
                            {_searching ? <CircularProgress color="inherit" size={18} /> : null}
                            {params.InputProps.endAdornment}
                        </React.Fragment>
                    ),
                }}
            />
        );
    };

    render() {
        const {
            classes,
            _username,
            _role,
            _authors,
            _selected_author,
            _searching,
            _broadcasting,
            open,
        } = this.state;

        // Disable confirm when: no username, user is already a team member, or broadcasting
        const isAlreadyMember = _username.length > 0 && this._isTeamMember(_username);
        const confirmDisabled = !_username || isAlreadyMember || _broadcasting;

        return (
            <Dialog
                open={open}
                fullWidth={true}
                maxWidth={"xs"}
                disablePortal={false}
                onClose={this.props.onClose}
                keepMounted={false}
                PaperProps={{ classes: { root: classes.darkGreyDialog } }}
            >
                <DialogContent>
                    <Typography component={"h2"} variant={"h6"}>{t("components.add_someone_community_dialog.add_someone")}</Typography>
                    <Typography variant="body2" color="textSecondary" component="p" style={DESC_STYLE}>
                        {t("components.add_someone_community_dialog.add_a_team_member_to_this_portal")}
                    </Typography>

                    {_broadcasting && (
                        <LinearProgress className={classes.progress} style={PROGRESS_STYLE} />
                    )}

                    <Autocomplete
                        classes={{ paper: classes.popper }}
                        options={_authors}
                        getOptionLabel={getAuthorOptionLabel}
                        getOptionDisabled={this._getOptionDisabled}
                        filterOptions={identityFilter}
                        inputValue={_username}
                        onChange={this._onAutocompleteChange}
                        onInputChange={this._onUsernameInputChange}
                        loading={_searching}
                        loadingText={t("words.searching")}
                        noOptionsText={_username.length > 0 ? "No accounts found" : "Type a username"}
                        disabled={_broadcasting}
                        renderOption={this._renderOption}
                        freeSolo
                        renderInput={this._renderInput}
                        style={AUTOCOMPLETE_STYLE}
                    />

                    {isAlreadyMember && _username.length > 0 && (
                        <Fade in timeout={200}>
                            <Typography variant="body2" component="p" style={ALREADY_MEMBER_STYLE}>{t("components.add_someone_community_dialog.is_already_part_of_the_team", {
                                    username: _username
                                })}</Typography>
                        </Fade>
                    )}

                    <FormControl component="fieldset" className={classes.roleGroup}>
                        <FormLabel component="legend">{t("components.add_someone_community_dialog.role")}</FormLabel>
                        <RadioGroup
                            row
                            value={_role}
                            onChange={this._handleRoleChange}
                        >
                            <FormControlLabel
                                value="admin"
                                control={<Radio size="small" />}
                                label={t("components.add_someone_community_dialog.admin")}
                                disabled={_broadcasting}
                            />
                            <FormControlLabel
                                value="mod"
                                control={<Radio size="small" />}
                                label={t("components.add_someone_community_dialog.mod")}
                                disabled={_broadcasting}
                            />
                        </RadioGroup>
                    </FormControl>
                </DialogContent>
                <DialogActions style={ACTIONS_STYLE}>
                    <Button
                        variant="text"
                        color="primary"
                        onClick={this.props.onClose}
                        disabled={_broadcasting}
                    >{t("words.cancel", {TUC: true})} </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={this._handleConfirm}
                        disabled={confirmDisabled}
                    >{t("words.confirm", {TUC: true})} </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(AddSomeoneCommunityDialog));