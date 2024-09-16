import * as React from 'preact/compat';
import { h } from 'preact';
import { useState, useMemo, useCallback, useRef } from 'preact/compat';
import withStyles from '@material-ui/core/styles/withStyles';
import Portal from '@material-ui/core/Portal';
import timeAgo from '../utils/TimeAgo';

import { t } from "../utils/text";

const styles = () => ({
    sankeyRoot: {
        position: 'relative',
        display: 'inline-block',
        cursor: 'default',
        userSelect: 'none',
    },
    portalTip: {
        position: 'fixed',
        pointerEvents: 'none',
        backgroundColor: '#222',
        color: '#ccc',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 11,
        fontFamily: '"Industry Book", monospace',
        lineHeight: '16px',
        zIndex: 99999,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'opacity 100ms ease',
        '& strong': {
            color: '#fff',
            fontWeight: 600,
        },
        '& .sub': {
            opacity: 0.55,
            fontSize: 10,
        },
    },
});

/**
 * Horizontal bezier band connecting a source segment (right edge) to a target segment (left edge).
 * sx = source right-edge x, sy = source top y, sh = source height
 * tx = target left-edge x,  ty = target top y, th = target height
 */
function bandPathH(sx, sy, sh, tx, ty, th) {
    const mx = (sx + tx) / 2;
    return [
        `M${sx},${sy}`,
        `C${mx},${sy} ${mx},${ty} ${tx},${ty}`,
        `L${tx},${ty + th}`,
        `C${mx},${ty + th} ${mx},${sy + sh} ${sx},${sy + sh}`,
        'Z',
    ].join(' ');
}

function pctToGrey(pct) {
    const v = Math.round((pct / 100) * 255);
    const hex = v.toString(16).padStart(2, '0');
    return '#' + hex + hex + hex;
}

function textColor(pct) {
    return pct > 45 ? '#222' : '#ddd';
}

function truncate(str, maxW, fontSize) {
    const charW = fontSize * 0.62;
    const maxChars = Math.floor((maxW - 6) / charW);
    if (str.length <= maxChars) return str;
    if (maxChars < 4) return '';
    return str.slice(0, maxChars - 1) + '\u2026';
}

function PayoutSankey({ classes, payout, data, pxsUsdPrice, pxaUsdPrice, currency, fiatRate }) {
    const [tip, setTip] = useState(null);

    const info = useMemo(() => {
        // Prices flow in as props from PaperCardActions (which reads them from
        // api.prices via usePrices). Fallbacks reflect Pixagram's economic design:
        // PXS = $5.69 (Big Mac anchor), PXA = $0.06.
        const pxsRate = Number.isFinite(pxsUsdPrice) && pxsUsdPrice > 0 ? pxsUsdPrice : 5.69;
        const pxaRate = Number.isFinite(pxaUsdPrice) && pxaUsdPrice > 0 ? pxaUsdPrice : 0.06;

        // `payout` is the post's pending payout, denominated in PXS.
        const totalUSD = payout * pxsRate;

        // Reward split: 50% paid as PXS (liquid stable), 50% as PXP (staked, PXA-equiv).
        // If `data` provides explicit breakdowns (e.g. from reward_pxs_balance and
        // reward_vesting_balance on chain), prefer those over the 50/50 assumption.
        let pxsAmount, pxaAmount;
        if (data && Number.isFinite(data.rewardPxs) && Number.isFinite(data.rewardPxa)) {
            pxsAmount = data.rewardPxs;
            pxaAmount = data.rewardPxa;
        } else {
            const halfUSD = totalUSD / 2;
            pxsAmount = halfUSD / pxsRate;
            pxaAmount = halfUSD / pxaRate;
        }

        const creatorsP = data?.creatorsPercent ?? 60;
        const curatorsP = data?.curatorsPercent ?? 40;
        const creatorsUSD = totalUSD * creatorsP / 100;
        const curatorsUSD = totalUSD * curatorsP / 100;
        const creatorsPXS = pxsAmount * creatorsP / 100;
        const creatorsPXA = pxaAmount * creatorsP / 100;
        const curatorsPXS = pxsAmount * curatorsP / 100;
        const curatorsPXA = pxaAmount * curatorsP / 100;

        const author = data?.author || {};
        const bens = data?.beneficiaries && data.beneficiaries.length > 0
            ? data.beneficiaries.map(b => ({ account: b.account, pct: parseFloat(b.percent || 0) }))
            : [{ account: author.username || 'author', pct: 100 }];

        const authors = bens.map(b => ({
            ...b,
            absPct: b.pct * creatorsP / 100,
            usd: creatorsUSD * b.pct / 100,
            pxs: creatorsPXS * b.pct / 100,
            pxa: creatorsPXA * b.pct / 100,
        }));

        const payoutDate = (data?.date || Date.now()) + 7 * 24 * 60 * 60 * 1000;

        return {
            totalUSD, pxsAmount, pxaAmount,
            creatorsP, curatorsP,
            creatorsUSD, curatorsUSD,
            creatorsPXS, creatorsPXA,
            curatorsPXS, curatorsPXA,
            authors, payoutDate,
        };
    }, [payout, data, pxsUsdPrice, pxaUsdPrice]);

    // ─── layout ───
    const barW = 48;
    const flowSpace = 34;
    const pad = 6;
    const barAreaTop = 6;
    const barAreaH = 80;
    const flowGap = 3; // vertical gap between creators/curators in col1
    const flowOpacity = 0.3;

    const showCreators = info.creatorsP > 0;
    const showCurators = info.curatorsP > 0;
    const totalParts = (showCreators ? info.creatorsP : 0) + (showCurators ? info.curatorsP : 0);

    // Column x positions
    const col0X = pad;
    const col1X = pad + barW + flowSpace;
    const col2X = col1X + barW + flowSpace;
    const W = col2X + barW + pad;
    const H = barAreaTop + barAreaH + 16; // 16 for payout text

    // Reward bar: full height
    const rewardY = barAreaTop;
    const rewardH = barAreaH;

    // Creators / Curators in col1
    const usableCol1 = barAreaH - (showCreators && showCurators ? flowGap : 0);
    const creatorsH = showCreators ? usableCol1 * info.creatorsP / totalParts : 0;
    const curatorsH = showCurators ? usableCol1 * info.curatorsP / totalParts : 0;
    const creatorsY = barAreaTop;
    const curatorsY = showCreators ? barAreaTop + creatorsH + flowGap : barAreaTop;

    const creatorsFill = pctToGrey(info.creatorsP);
    const curatorsFill = pctToGrey(info.curatorsP);

    // Reward right-edge source slices (split proportionally)
    const rwCreatorsSliceY = barAreaTop;
    const rwCreatorsSliceH = showCreators ? barAreaH * info.creatorsP / totalParts : 0;
    const rwCuratorsSliceY = barAreaTop + rwCreatorsSliceH;
    const rwCuratorsSliceH = showCurators ? barAreaH * info.curatorsP / totalParts : 0;

    // Author bars in col2 — stacked vertically within creators zone
    const authorBars = useMemo(() => {
        if (!showCreators || info.authors.length === 0) return [];
        const gap = 2;
        const totalGap = (info.authors.length - 1) * gap;
        const usable = creatorsH - totalGap;
        let cy = creatorsY;
        return info.authors.map(a => {
            const h = Math.max(10, usable * a.pct / 100);
            const bar = { ...a, y: cy, h, fill: pctToGrey(a.absPct) };
            cy += h + gap;
            return bar;
        });
    }, [info.authors, creatorsH, creatorsY, showCreators]);

    // Creators right-edge source slices for each author
    const authorSrcSlices = useMemo(() => {
        let sy = creatorsY;
        return authorBars.map(a => {
            const sh = creatorsH * a.pct / 100;
            const slice = { y: sy, h: sh };
            sy += sh;
            return slice;
        });
    }, [authorBars, creatorsH, creatorsY]);

    const showAuthors = showCreators && authorBars.length > 0;

    // ─── tooltip via Portal ───
    const show = useCallback((e, content) => {
        setTip({ content, x: e.clientX + 12, y: e.clientY - 40 });
    }, []);
    const move = useCallback((e) => {
        setTip(prev => prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 40 } : null);
    }, []);
    const hide = useCallback(() => setTip(null), []);
    // USD figures convert to the user's display currency at render time. The
    // amounts above stay USD-anchored; only the formatter localizes. ISO code
    // (not symbol) keeps "$"/"kr"/"¥" unambiguous across currencies.
    const fiatMul = Number.isFinite(fiatRate) && fiatRate > 0 ? fiatRate : 1;
    const fiatCur = currency || 'USD';
    const fmt = usd => `${(usd * fiatMul).toFixed(2)} ${fiatCur}`;
    const fmtP = v => v.toFixed(2);

    return (
        <div className={classes.sankeyRoot}>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}
                 xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                <defs>
                    {/* Reward → Creators (horizontal) */}
                    {showCreators && (
                        <linearGradient id="psk-hfc" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#fff" stopOpacity={flowOpacity} />
                            <stop offset="100%" stopColor={creatorsFill} stopOpacity={flowOpacity} />
                        </linearGradient>
                    )}
                    {/* Reward → Curators (horizontal) */}
                    {showCurators && (
                        <linearGradient id="psk-hfq" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#fff" stopOpacity={flowOpacity} />
                            <stop offset="100%" stopColor={curatorsFill} stopOpacity={flowOpacity} />
                        </linearGradient>
                    )}
                    {/* Curators → fade right */}
                    {showCurators && (
                        <linearGradient id="psk-hcfade" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={curatorsFill} stopOpacity={flowOpacity} />
                            <stop offset="100%" stopColor={curatorsFill} stopOpacity="0" />
                        </linearGradient>
                    )}
                    {/* Creators → each Author (unique per author) */}
                    {showAuthors && authorBars.map((a, i) => (
                        <linearGradient key={i} id={`psk-hfa${i}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={creatorsFill} stopOpacity={flowOpacity} />
                            <stop offset="100%" stopColor={a.fill} stopOpacity={flowOpacity} />
                        </linearGradient>
                    ))}
                </defs>

                {/* ── FLOWS ── */}

                {/* Reward → Creators */}
                {showCreators && (
                    <path d={bandPathH(
                        col0X + barW, rwCreatorsSliceY, rwCreatorsSliceH,
                        col1X, creatorsY, creatorsH
                    )} fill="url(#psk-hfc)" />
                )}

                {/* Reward → Curators */}
                {showCurators && (
                    <path d={bandPathH(
                        col0X + barW, rwCuratorsSliceY, rwCuratorsSliceH,
                        col1X, curatorsY, curatorsH
                    )} fill="url(#psk-hfq)" />
                )}

                {/* Creators → Authors */}
                {showAuthors && authorBars.map((a, i) => (
                    <path key={'hfa'+i} d={bandPathH(
                        col1X + barW, authorSrcSlices[i].y, authorSrcSlices[i].h,
                        col2X, a.y, a.h
                    )} fill={`url(#psk-hfa${i})`} />
                ))}

                {/* Curators → fade right into void */}
                {showCurators && (
                    <path d={bandPathH(
                        col1X + barW, curatorsY, curatorsH,
                        col2X + barW, curatorsY, curatorsH
                    )} fill="url(#psk-hcfade)" />
                )}

                {/* ══ BARS ══ */}

                {/* Reward — white, full height */}
                <g onMouseEnter={e => show(e, { title: 'Reward', usd: info.totalUSD, pxs: info.pxsAmount, pxa: info.pxaAmount })}
                   onMouseMove={move} onMouseLeave={hide} style={{ cursor: 'pointer' }}>
                    <rect x={col0X} y={rewardY} width={barW} height={rewardH} rx={3} fill="#fff" />
                    <text x={col0X + barW / 2} y={rewardY + rewardH / 2} textAnchor="middle" dominantBaseline="central"
                          fill="#222" fontSize="9" fontWeight="600" fontFamily='"Industry Book", sans-serif'>
                        {t("components.payout_sankey.reward")}
                    </text>
                </g>

                {/* Creators */}
                {showCreators && (
                    <g onMouseEnter={e => show(e, { title: `Creators (${info.creatorsP}%)`, usd: info.creatorsUSD, pxs: info.creatorsPXS, pxa: info.creatorsPXA })}
                       onMouseMove={move} onMouseLeave={hide} style={{ cursor: 'pointer' }}>
                        <rect x={col1X} y={creatorsY} width={barW} height={creatorsH} rx={3} fill={creatorsFill} />
                        {creatorsH > 14 && (
                            <text x={col1X + barW / 2} y={creatorsY + creatorsH / 2} textAnchor="middle"
                                  dominantBaseline="central" fill={textColor(info.creatorsP)} fontSize="8" fontWeight="600"
                                  fontFamily='"Industry Book", "Normative Pro", sans-serif'>
                                {truncate('Creators', barW, 8)}
                            </text>
                        )}
                    </g>
                )}

                {/* Curators */}
                {showCurators && (
                    <g onMouseEnter={e => show(e, { title: `Curators (${info.curatorsP}%)`, usd: info.curatorsUSD, pxs: info.curatorsPXS, pxa: info.curatorsPXA })}
                       onMouseMove={move} onMouseLeave={hide} style={{ cursor: 'pointer' }}>
                        <rect x={col1X} y={curatorsY} width={barW} height={curatorsH} rx={3} fill={curatorsFill} />
                        {curatorsH > 14 && (
                            <text x={col1X + barW / 2} y={curatorsY + curatorsH / 2} textAnchor="middle"
                                  dominantBaseline="central" fill={textColor(info.curatorsP)} fontSize="8" fontWeight="500"
                                  fontFamily='"Industry Book", "Normative Pro", sans-serif'>
                                {truncate('Curators', barW, 8)}
                            </text>
                        )}
                    </g>
                )}

                {/* Author bars */}
                {showAuthors && authorBars.map((a, i) => {
                    const label = truncate('@' + a.account, barW, 7.5);
                    return (
                        <g key={'hab'+i}
                           onMouseEnter={e => show(e, { title: `@${a.account} (${a.pct.toFixed(0)}%)`, usd: a.usd, pxs: a.pxs, pxa: a.pxa })}
                           onMouseMove={move} onMouseLeave={hide} style={{ cursor: 'pointer' }}>
                            <rect x={col2X} y={a.y} width={barW} height={a.h} rx={2} fill={a.fill} />
                            {a.h > 12 && label && (
                                <text x={col2X + barW / 2} y={a.y + a.h / 2} textAnchor="middle"
                                      dominantBaseline="central" fill={textColor(a.absPct)} fontSize="7.5" fontWeight="500"
                                      fontFamily='"Industry Book", "Normative Pro", sans-serif'>
                                    {label}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Payout countdown */}
                <text x={W / 2} y={H - 4} textAnchor="middle" dominantBaseline="central"
                      fill="#666" fontSize="9" fontWeight="400"
                      fontFamily='"Normative Pro", "Industry Book", sans-serif'>{t("components.payout_sankey.payout", {
                        timeAgo: timeAgo.format(info.payoutDate)
                    })}</text>
            </svg>
            {/* Portal tooltip */}
            {tip && (
                <Portal>
                    <div
                        className={classes.portalTip}
                        style={{ left: tip.x, top: tip.y, opacity: 1 }}
                    >
                        <div><strong>{tip.content.title}</strong></div>
                        <div>{fmt(tip.content.usd)}</div>
                        <div className="sub">+{fmtP(tip.content.pxs)} PXS</div>
                        <div className="sub">+{fmtP(tip.content.pxa)} PXA</div>
                    </div>
                </Portal>
            )}
        </div>
    );
}

export default withStyles(styles)(PayoutSankey);