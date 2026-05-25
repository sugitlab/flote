(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.svg2roughjs = {}));
})(this, (function (exports) { 'use strict';

    function rotatePoints(points, center, degrees) {
        if (points && points.length) {
            const [cx, cy] = center;
            const angle = (Math.PI / 180) * degrees;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            for (const p of points) {
                const [x, y] = p;
                p[0] = ((x - cx) * cos) - ((y - cy) * sin) + cx;
                p[1] = ((x - cx) * sin) + ((y - cy) * cos) + cy;
            }
        }
    }
    function rotateLines(lines, center, degrees) {
        const points = [];
        lines.forEach((line) => points.push(...line));
        rotatePoints(points, center, degrees);
    }
    function areSamePoints(p1, p2) {
        return p1[0] === p2[0] && p1[1] === p2[1];
    }
    function hachureLines(polygons, hachureGap, hachureAngle, hachureStepOffset = 1) {
        const angle = hachureAngle;
        const gap = Math.max(hachureGap, 0.1);
        const polygonList = (polygons[0] && polygons[0][0] && (typeof polygons[0][0] === 'number')) ? [polygons] : polygons;
        const rotationCenter = [0, 0];
        if (angle) {
            for (const polygon of polygonList) {
                rotatePoints(polygon, rotationCenter, angle);
            }
        }
        const lines = straightHachureLines(polygonList, gap, hachureStepOffset);
        if (angle) {
            for (const polygon of polygonList) {
                rotatePoints(polygon, rotationCenter, -angle);
            }
            rotateLines(lines, rotationCenter, -angle);
        }
        return lines;
    }
    function straightHachureLines(polygons, gap, hachureStepOffset) {
        const vertexArray = [];
        for (const polygon of polygons) {
            const vertices = [...polygon];
            if (!areSamePoints(vertices[0], vertices[vertices.length - 1])) {
                vertices.push([vertices[0][0], vertices[0][1]]);
            }
            if (vertices.length > 2) {
                vertexArray.push(vertices);
            }
        }
        const lines = [];
        gap = Math.max(gap, 0.1);
        // Create sorted edges table
        const edges = [];
        for (const vertices of vertexArray) {
            for (let i = 0; i < vertices.length - 1; i++) {
                const p1 = vertices[i];
                const p2 = vertices[i + 1];
                if (p1[1] !== p2[1]) {
                    const ymin = Math.min(p1[1], p2[1]);
                    edges.push({
                        ymin,
                        ymax: Math.max(p1[1], p2[1]),
                        x: ymin === p1[1] ? p1[0] : p2[0],
                        islope: (p2[0] - p1[0]) / (p2[1] - p1[1]),
                    });
                }
            }
        }
        edges.sort((e1, e2) => {
            if (e1.ymin < e2.ymin) {
                return -1;
            }
            if (e1.ymin > e2.ymin) {
                return 1;
            }
            if (e1.x < e2.x) {
                return -1;
            }
            if (e1.x > e2.x) {
                return 1;
            }
            if (e1.ymax === e2.ymax) {
                return 0;
            }
            return (e1.ymax - e2.ymax) / Math.abs((e1.ymax - e2.ymax));
        });
        if (!edges.length) {
            return lines;
        }
        // Start scanning
        let activeEdges = [];
        let y = edges[0].ymin;
        let iteration = 0;
        while (activeEdges.length || edges.length) {
            if (edges.length) {
                let ix = -1;
                for (let i = 0; i < edges.length; i++) {
                    if (edges[i].ymin > y) {
                        break;
                    }
                    ix = i;
                }
                const removed = edges.splice(0, ix + 1);
                removed.forEach((edge) => {
                    activeEdges.push({ s: y, edge });
                });
            }
            activeEdges = activeEdges.filter((ae) => {
                if (ae.edge.ymax <= y) {
                    return false;
                }
                return true;
            });
            activeEdges.sort((ae1, ae2) => {
                if (ae1.edge.x === ae2.edge.x) {
                    return 0;
                }
                return (ae1.edge.x - ae2.edge.x) / Math.abs((ae1.edge.x - ae2.edge.x));
            });
            // fill between the edges
            if ((hachureStepOffset !== 1) || (iteration % gap === 0)) {
                if (activeEdges.length > 1) {
                    for (let i = 0; i < activeEdges.length; i = i + 2) {
                        const nexti = i + 1;
                        if (nexti >= activeEdges.length) {
                            break;
                        }
                        const ce = activeEdges[i].edge;
                        const ne = activeEdges[nexti].edge;
                        lines.push([
                            [Math.round(ce.x), y],
                            [Math.round(ne.x), y],
                        ]);
                    }
                }
            }
            y += hachureStepOffset;
            activeEdges.forEach((ae) => {
                ae.edge.x = ae.edge.x + (hachureStepOffset * ae.edge.islope);
            });
            iteration++;
        }
        return lines;
    }

    function polygonHachureLines(polygonList, o) {
        var _a;
        const angle = o.hachureAngle + 90;
        let gap = o.hachureGap;
        if (gap < 0) {
            gap = o.strokeWidth * 4;
        }
        gap = Math.round(Math.max(gap, 0.1));
        let skipOffset = 1;
        if (o.roughness >= 1) {
            if ((((_a = o.randomizer) === null || _a === void 0 ? void 0 : _a.next()) || Math.random()) > 0.7) {
                skipOffset = gap;
            }
        }
        return hachureLines(polygonList, gap, angle, skipOffset || 1);
    }

    class HachureFiller {
        constructor(helper) {
            this.helper = helper;
        }
        fillPolygons(polygonList, o) {
            return this._fillPolygons(polygonList, o);
        }
        _fillPolygons(polygonList, o) {
            const lines = polygonHachureLines(polygonList, o);
            const ops = this.renderLines(lines, o);
            return { type: 'fillSketch', ops };
        }
        renderLines(lines, o) {
            const ops = [];
            for (const line of lines) {
                ops.push(...this.helper.doubleLineOps(line[0][0], line[0][1], line[1][0], line[1][1], o));
            }
            return ops;
        }
    }

    function lineLength(line) {
        const p1 = line[0];
        const p2 = line[1];
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    }

    class ZigZagFiller extends HachureFiller {
        fillPolygons(polygonList, o) {
            let gap = o.hachureGap;
            if (gap < 0) {
                gap = o.strokeWidth * 4;
            }
            gap = Math.max(gap, 0.1);
            const o2 = Object.assign({}, o, { hachureGap: gap });
            const lines = polygonHachureLines(polygonList, o2);
            const zigZagAngle = (Math.PI / 180) * o.hachureAngle;
            const zigzagLines = [];
            const dgx = gap * 0.5 * Math.cos(zigZagAngle);
            const dgy = gap * 0.5 * Math.sin(zigZagAngle);
            for (const [p1, p2] of lines) {
                if (lineLength([p1, p2])) {
                    zigzagLines.push([
                        [p1[0] - dgx, p1[1] + dgy],
                        [...p2],
                    ], [
                        [p1[0] + dgx, p1[1] - dgy],
                        [...p2],
                    ]);
                }
            }
            const ops = this.renderLines(zigzagLines, o);
            return { type: 'fillSketch', ops };
        }
    }

    class HatchFiller extends HachureFiller {
        fillPolygons(polygonList, o) {
            const set = this._fillPolygons(polygonList, o);
            const o2 = Object.assign({}, o, { hachureAngle: o.hachureAngle + 90 });
            const set2 = this._fillPolygons(polygonList, o2);
            set.ops = set.ops.concat(set2.ops);
            return set;
        }
    }

    class DotFiller {
        constructor(helper) {
            this.helper = helper;
        }
        fillPolygons(polygonList, o) {
            o = Object.assign({}, o, { hachureAngle: 0 });
            const lines = polygonHachureLines(polygonList, o);
            return this.dotsOnLines(lines, o);
        }
        dotsOnLines(lines, o) {
            const ops = [];
            let gap = o.hachureGap;
            if (gap < 0) {
                gap = o.strokeWidth * 4;
            }
            gap = Math.max(gap, 0.1);
            let fweight = o.fillWeight;
            if (fweight < 0) {
                fweight = o.strokeWidth / 2;
            }
            const ro = gap / 4;
            for (const line of lines) {
                const length = lineLength(line);
                const dl = length / gap;
                const count = Math.ceil(dl) - 1;
                const offset = length - (count * gap);
                const x = ((line[0][0] + line[1][0]) / 2) - (gap / 4);
                const minY = Math.min(line[0][1], line[1][1]);
                for (let i = 0; i < count; i++) {
                    const y = minY + offset + (i * gap);
                    const cx = (x - ro) + Math.random() * 2 * ro;
                    const cy = (y - ro) + Math.random() * 2 * ro;
                    const el = this.helper.ellipse(cx, cy, fweight, fweight, o);
                    ops.push(...el.ops);
                }
            }
            return { type: 'fillSketch', ops };
        }
    }

    class DashedFiller {
        constructor(helper) {
            this.helper = helper;
        }
        fillPolygons(polygonList, o) {
            const lines = polygonHachureLines(polygonList, o);
            return { type: 'fillSketch', ops: this.dashedLine(lines, o) };
        }
        dashedLine(lines, o) {
            const offset = o.dashOffset < 0 ? (o.hachureGap < 0 ? (o.strokeWidth * 4) : o.hachureGap) : o.dashOffset;
            const gap = o.dashGap < 0 ? (o.hachureGap < 0 ? (o.strokeWidth * 4) : o.hachureGap) : o.dashGap;
            const ops = [];
            lines.forEach((line) => {
                const length = lineLength(line);
                const count = Math.floor(length / (offset + gap));
                const startOffset = (length + gap - (count * (offset + gap))) / 2;
                let p1 = line[0];
                let p2 = line[1];
                if (p1[0] > p2[0]) {
                    p1 = line[1];
                    p2 = line[0];
                }
                const alpha = Math.atan((p2[1] - p1[1]) / (p2[0] - p1[0]));
                for (let i = 0; i < count; i++) {
                    const lstart = i * (offset + gap);
                    const lend = lstart + offset;
                    const start = [p1[0] + (lstart * Math.cos(alpha)) + (startOffset * Math.cos(alpha)), p1[1] + lstart * Math.sin(alpha) + (startOffset * Math.sin(alpha))];
                    const end = [p1[0] + (lend * Math.cos(alpha)) + (startOffset * Math.cos(alpha)), p1[1] + (lend * Math.sin(alpha)) + (startOffset * Math.sin(alpha))];
                    ops.push(...this.helper.doubleLineOps(start[0], start[1], end[0], end[1], o));
                }
            });
            return ops;
        }
    }

    class ZigZagLineFiller {
        constructor(helper) {
            this.helper = helper;
        }
        fillPolygons(polygonList, o) {
            const gap = o.hachureGap < 0 ? (o.strokeWidth * 4) : o.hachureGap;
            const zo = o.zigzagOffset < 0 ? gap : o.zigzagOffset;
            o = Object.assign({}, o, { hachureGap: gap + zo });
            const lines = polygonHachureLines(polygonList, o);
            return { type: 'fillSketch', ops: this.zigzagLines(lines, zo, o) };
        }
        zigzagLines(lines, zo, o) {
            const ops = [];
            lines.forEach((line) => {
                const length = lineLength(line);
                const count = Math.round(length / (2 * zo));
                let p1 = line[0];
                let p2 = line[1];
                if (p1[0] > p2[0]) {
                    p1 = line[1];
                    p2 = line[0];
                }
                const alpha = Math.atan((p2[1] - p1[1]) / (p2[0] - p1[0]));
                for (let i = 0; i < count; i++) {
                    const lstart = i * 2 * zo;
                    const lend = (i + 1) * 2 * zo;
                    const dz = Math.sqrt(2 * Math.pow(zo, 2));
                    const start = [p1[0] + (lstart * Math.cos(alpha)), p1[1] + lstart * Math.sin(alpha)];
                    const end = [p1[0] + (lend * Math.cos(alpha)), p1[1] + (lend * Math.sin(alpha))];
                    const middle = [start[0] + dz * Math.cos(alpha + Math.PI / 4), start[1] + dz * Math.sin(alpha + Math.PI / 4)];
                    ops.push(...this.helper.doubleLineOps(start[0], start[1], middle[0], middle[1], o), ...this.helper.doubleLineOps(middle[0], middle[1], end[0], end[1], o));
                }
            });
            return ops;
        }
    }

    const fillers = {};
    function getFiller(o, helper) {
        let fillerName = o.fillStyle || 'hachure';
        if (!fillers[fillerName]) {
            switch (fillerName) {
                case 'zigzag':
                    if (!fillers[fillerName]) {
                        fillers[fillerName] = new ZigZagFiller(helper);
                    }
                    break;
                case 'cross-hatch':
                    if (!fillers[fillerName]) {
                        fillers[fillerName] = new HatchFiller(helper);
                    }
                    break;
                case 'dots':
                    if (!fillers[fillerName]) {
                        fillers[fillerName] = new DotFiller(helper);
                    }
                    break;
                case 'dashed':
                    if (!fillers[fillerName]) {
                        fillers[fillerName] = new DashedFiller(helper);
                    }
                    break;
                case 'zigzag-line':
                    if (!fillers[fillerName]) {
                        fillers[fillerName] = new ZigZagLineFiller(helper);
                    }
                    break;
                case 'hachure':
                default:
                    fillerName = 'hachure';
                    if (!fillers[fillerName]) {
                        fillers[fillerName] = new HachureFiller(helper);
                    }
                    break;
            }
        }
        return fillers[fillerName];
    }

    function randomSeed() {
        return Math.floor(Math.random() * 2 ** 31);
    }
    class Random {
        constructor(seed) {
            this.seed = seed;
        }
        next() {
            if (this.seed) {
                return ((2 ** 31 - 1) & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31;
            }
            else {
                return Math.random();
            }
        }
    }

    const COMMAND = 0;
    const NUMBER = 1;
    const EOD = 2;
    const PARAMS = { A: 7, a: 7, C: 6, c: 6, H: 1, h: 1, L: 2, l: 2, M: 2, m: 2, Q: 4, q: 4, S: 4, s: 4, T: 2, t: 2, V: 1, v: 1, Z: 0, z: 0 };
    function tokenize(d) {
        const tokens = new Array();
        while (d !== '') {
            if (d.match(/^([ \t\r\n,]+)/)) {
                d = d.substr(RegExp.$1.length);
            }
            else if (d.match(/^([aAcChHlLmMqQsStTvVzZ])/)) {
                tokens[tokens.length] = { type: COMMAND, text: RegExp.$1 };
                d = d.substr(RegExp.$1.length);
            }
            else if (d.match(/^(([-+]?[0-9]+(\.[0-9]*)?|[-+]?\.[0-9]+)([eE][-+]?[0-9]+)?)/)) {
                tokens[tokens.length] = { type: NUMBER, text: `${parseFloat(RegExp.$1)}` };
                d = d.substr(RegExp.$1.length);
            }
            else {
                return [];
            }
        }
        tokens[tokens.length] = { type: EOD, text: '' };
        return tokens;
    }
    function isType(token, type) {
        return token.type === type;
    }
    function parsePath(d) {
        const segments = [];
        const tokens = tokenize(d);
        let mode = 'BOD';
        let index = 0;
        let token = tokens[index];
        while (!isType(token, EOD)) {
            let paramsCount = 0;
            const params = [];
            if (mode === 'BOD') {
                if (token.text === 'M' || token.text === 'm') {
                    index++;
                    paramsCount = PARAMS[token.text];
                    mode = token.text;
                }
                else {
                    return parsePath('M0,0' + d);
                }
            }
            else if (isType(token, NUMBER)) {
                paramsCount = PARAMS[mode];
            }
            else {
                index++;
                paramsCount = PARAMS[token.text];
                mode = token.text;
            }
            if ((index + paramsCount) < tokens.length) {
                for (let i = index; i < index + paramsCount; i++) {
                    const numbeToken = tokens[i];
                    if (isType(numbeToken, NUMBER)) {
                        params[params.length] = +numbeToken.text;
                    }
                    else {
                        throw new Error('Param not a number: ' + mode + ',' + numbeToken.text);
                    }
                }
                if (typeof PARAMS[mode] === 'number') {
                    const segment = { key: mode, data: params };
                    segments.push(segment);
                    index += paramsCount;
                    token = tokens[index];
                    if (mode === 'M')
                        mode = 'L';
                    if (mode === 'm')
                        mode = 'l';
                }
                else {
                    throw new Error('Bad segment: ' + mode);
                }
            }
            else {
                throw new Error('Path data ended short');
            }
        }
        return segments;
    }

    // Translate relative commands to absolute commands
    function absolutize(segments) {
        let cx = 0, cy = 0;
        let subx = 0, suby = 0;
        const out = [];
        for (const { key, data } of segments) {
            switch (key) {
                case 'M':
                    out.push({ key: 'M', data: [...data] });
                    [cx, cy] = data;
                    [subx, suby] = data;
                    break;
                case 'm':
                    cx += data[0];
                    cy += data[1];
                    out.push({ key: 'M', data: [cx, cy] });
                    subx = cx;
                    suby = cy;
                    break;
                case 'L':
                    out.push({ key: 'L', data: [...data] });
                    [cx, cy] = data;
                    break;
                case 'l':
                    cx += data[0];
                    cy += data[1];
                    out.push({ key: 'L', data: [cx, cy] });
                    break;
                case 'C':
                    out.push({ key: 'C', data: [...data] });
                    cx = data[4];
                    cy = data[5];
                    break;
                case 'c': {
                    const newdata = data.map((d, i) => (i % 2) ? (d + cy) : (d + cx));
                    out.push({ key: 'C', data: newdata });
                    cx = newdata[4];
                    cy = newdata[5];
                    break;
                }
                case 'Q':
                    out.push({ key: 'Q', data: [...data] });
                    cx = data[2];
                    cy = data[3];
                    break;
                case 'q': {
                    const newdata = data.map((d, i) => (i % 2) ? (d + cy) : (d + cx));
                    out.push({ key: 'Q', data: newdata });
                    cx = newdata[2];
                    cy = newdata[3];
                    break;
                }
                case 'A':
                    out.push({ key: 'A', data: [...data] });
                    cx = data[5];
                    cy = data[6];
                    break;
                case 'a':
                    cx += data[5];
                    cy += data[6];
                    out.push({ key: 'A', data: [data[0], data[1], data[2], data[3], data[4], cx, cy] });
                    break;
                case 'H':
                    out.push({ key: 'H', data: [...data] });
                    cx = data[0];
                    break;
                case 'h':
                    cx += data[0];
                    out.push({ key: 'H', data: [cx] });
                    break;
                case 'V':
                    out.push({ key: 'V', data: [...data] });
                    cy = data[0];
                    break;
                case 'v':
                    cy += data[0];
                    out.push({ key: 'V', data: [cy] });
                    break;
                case 'S':
                    out.push({ key: 'S', data: [...data] });
                    cx = data[2];
                    cy = data[3];
                    break;
                case 's': {
                    const newdata = data.map((d, i) => (i % 2) ? (d + cy) : (d + cx));
                    out.push({ key: 'S', data: newdata });
                    cx = newdata[2];
                    cy = newdata[3];
                    break;
                }
                case 'T':
                    out.push({ key: 'T', data: [...data] });
                    cx = data[0];
                    cy = data[1];
                    break;
                case 't':
                    cx += data[0];
                    cy += data[1];
                    out.push({ key: 'T', data: [cx, cy] });
                    break;
                case 'Z':
                case 'z':
                    out.push({ key: 'Z', data: [] });
                    cx = subx;
                    cy = suby;
                    break;
            }
        }
        return out;
    }

    // Normalize path to include only M, L, C, and Z commands
    function normalize(segments) {
        const out = [];
        let lastType = '';
        let cx = 0, cy = 0;
        let subx = 0, suby = 0;
        let lcx = 0, lcy = 0;
        for (const { key, data } of segments) {
            switch (key) {
                case 'M':
                    out.push({ key: 'M', data: [...data] });
                    [cx, cy] = data;
                    [subx, suby] = data;
                    break;
                case 'C':
                    out.push({ key: 'C', data: [...data] });
                    cx = data[4];
                    cy = data[5];
                    lcx = data[2];
                    lcy = data[3];
                    break;
                case 'L':
                    out.push({ key: 'L', data: [...data] });
                    [cx, cy] = data;
                    break;
                case 'H':
                    cx = data[0];
                    out.push({ key: 'L', data: [cx, cy] });
                    break;
                case 'V':
                    cy = data[0];
                    out.push({ key: 'L', data: [cx, cy] });
                    break;
                case 'S': {
                    let cx1 = 0, cy1 = 0;
                    if (lastType === 'C' || lastType === 'S') {
                        cx1 = cx + (cx - lcx);
                        cy1 = cy + (cy - lcy);
                    }
                    else {
                        cx1 = cx;
                        cy1 = cy;
                    }
                    out.push({ key: 'C', data: [cx1, cy1, ...data] });
                    lcx = data[0];
                    lcy = data[1];
                    cx = data[2];
                    cy = data[3];
                    break;
                }
                case 'T': {
                    const [x, y] = data;
                    let x1 = 0, y1 = 0;
                    if (lastType === 'Q' || lastType === 'T') {
                        x1 = cx + (cx - lcx);
                        y1 = cy + (cy - lcy);
                    }
                    else {
                        x1 = cx;
                        y1 = cy;
                    }
                    const cx1 = cx + 2 * (x1 - cx) / 3;
                    const cy1 = cy + 2 * (y1 - cy) / 3;
                    const cx2 = x + 2 * (x1 - x) / 3;
                    const cy2 = y + 2 * (y1 - y) / 3;
                    out.push({ key: 'C', data: [cx1, cy1, cx2, cy2, x, y] });
                    lcx = x1;
                    lcy = y1;
                    cx = x;
                    cy = y;
                    break;
                }
                case 'Q': {
                    const [x1, y1, x, y] = data;
                    const cx1 = cx + 2 * (x1 - cx) / 3;
                    const cy1 = cy + 2 * (y1 - cy) / 3;
                    const cx2 = x + 2 * (x1 - x) / 3;
                    const cy2 = y + 2 * (y1 - y) / 3;
                    out.push({ key: 'C', data: [cx1, cy1, cx2, cy2, x, y] });
                    lcx = x1;
                    lcy = y1;
                    cx = x;
                    cy = y;
                    break;
                }
                case 'A': {
                    const r1 = Math.abs(data[0]);
                    const r2 = Math.abs(data[1]);
                    const angle = data[2];
                    const largeArcFlag = data[3];
                    const sweepFlag = data[4];
                    const x = data[5];
                    const y = data[6];
                    if (r1 === 0 || r2 === 0) {
                        out.push({ key: 'C', data: [cx, cy, x, y, x, y] });
                        cx = x;
                        cy = y;
                    }
                    else {
                        if (cx !== x || cy !== y) {
                            const curves = arcToCubicCurves(cx, cy, x, y, r1, r2, angle, largeArcFlag, sweepFlag);
                            curves.forEach(function (curve) {
                                out.push({ key: 'C', data: curve });
                            });
                            cx = x;
                            cy = y;
                        }
                    }
                    break;
                }
                case 'Z':
                    out.push({ key: 'Z', data: [] });
                    cx = subx;
                    cy = suby;
                    break;
            }
            lastType = key;
        }
        return out;
    }
    function degToRad(degrees) {
        return (Math.PI * degrees) / 180;
    }
    function rotate(x, y, angleRad) {
        const X = x * Math.cos(angleRad) - y * Math.sin(angleRad);
        const Y = x * Math.sin(angleRad) + y * Math.cos(angleRad);
        return [X, Y];
    }
    function arcToCubicCurves(x1, y1, x2, y2, r1, r2, angle, largeArcFlag, sweepFlag, recursive) {
        const angleRad = degToRad(angle);
        let params = [];
        let f1 = 0, f2 = 0, cx = 0, cy = 0;
        if (recursive) {
            [f1, f2, cx, cy] = recursive;
        }
        else {
            [x1, y1] = rotate(x1, y1, -angleRad);
            [x2, y2] = rotate(x2, y2, -angleRad);
            const x = (x1 - x2) / 2;
            const y = (y1 - y2) / 2;
            let h = (x * x) / (r1 * r1) + (y * y) / (r2 * r2);
            if (h > 1) {
                h = Math.sqrt(h);
                r1 = h * r1;
                r2 = h * r2;
            }
            const sign = (largeArcFlag === sweepFlag) ? -1 : 1;
            const r1Pow = r1 * r1;
            const r2Pow = r2 * r2;
            const left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
            const right = r1Pow * y * y + r2Pow * x * x;
            const k = sign * Math.sqrt(Math.abs(left / right));
            cx = k * r1 * y / r2 + (x1 + x2) / 2;
            cy = k * -r2 * x / r1 + (y1 + y2) / 2;
            f1 = Math.asin(parseFloat(((y1 - cy) / r2).toFixed(9)));
            f2 = Math.asin(parseFloat(((y2 - cy) / r2).toFixed(9)));
            if (x1 < cx) {
                f1 = Math.PI - f1;
            }
            if (x2 < cx) {
                f2 = Math.PI - f2;
            }
            if (f1 < 0) {
                f1 = Math.PI * 2 + f1;
            }
            if (f2 < 0) {
                f2 = Math.PI * 2 + f2;
            }
            if (sweepFlag && f1 > f2) {
                f1 = f1 - Math.PI * 2;
            }
            if (!sweepFlag && f2 > f1) {
                f2 = f2 - Math.PI * 2;
            }
        }
        let df = f2 - f1;
        if (Math.abs(df) > (Math.PI * 120 / 180)) {
            const f2old = f2;
            const x2old = x2;
            const y2old = y2;
            if (sweepFlag && f2 > f1) {
                f2 = f1 + (Math.PI * 120 / 180) * (1);
            }
            else {
                f2 = f1 + (Math.PI * 120 / 180) * (-1);
            }
            x2 = cx + r1 * Math.cos(f2);
            y2 = cy + r2 * Math.sin(f2);
            params = arcToCubicCurves(x2, y2, x2old, y2old, r1, r2, angle, 0, sweepFlag, [f2, f2old, cx, cy]);
        }
        df = f2 - f1;
        const c1 = Math.cos(f1);
        const s1 = Math.sin(f1);
        const c2 = Math.cos(f2);
        const s2 = Math.sin(f2);
        const t = Math.tan(df / 4);
        const hx = 4 / 3 * r1 * t;
        const hy = 4 / 3 * r2 * t;
        const m1 = [x1, y1];
        const m2 = [x1 + hx * s1, y1 - hy * c1];
        const m3 = [x2 + hx * s2, y2 - hy * c2];
        const m4 = [x2, y2];
        m2[0] = 2 * m1[0] - m2[0];
        m2[1] = 2 * m1[1] - m2[1];
        if (recursive) {
            return [m2, m3, m4].concat(params);
        }
        else {
            params = [m2, m3, m4].concat(params);
            const curves = [];
            for (let i = 0; i < params.length; i += 3) {
                const r1 = rotate(params[i][0], params[i][1], angleRad);
                const r2 = rotate(params[i + 1][0], params[i + 1][1], angleRad);
                const r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad);
                curves.push([r1[0], r1[1], r2[0], r2[1], r3[0], r3[1]]);
            }
            return curves;
        }
    }

    const helper = {
        randOffset,
        randOffsetWithRange,
        ellipse,
        doubleLineOps: doubleLineFillOps,
    };
    function line(x1, y1, x2, y2, o) {
        return { type: 'path', ops: _doubleLine(x1, y1, x2, y2, o) };
    }
    function linearPath(points, close, o) {
        const len = (points || []).length;
        if (len > 2) {
            const ops = [];
            for (let i = 0; i < (len - 1); i++) {
                ops.push(..._doubleLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], o));
            }
            if (close) {
                ops.push(..._doubleLine(points[len - 1][0], points[len - 1][1], points[0][0], points[0][1], o));
            }
            return { type: 'path', ops };
        }
        else if (len === 2) {
            return line(points[0][0], points[0][1], points[1][0], points[1][1], o);
        }
        return { type: 'path', ops: [] };
    }
    function polygon(points, o) {
        return linearPath(points, true, o);
    }
    function rectangle(x, y, width, height, o) {
        const points = [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
        ];
        return polygon(points, o);
    }
    function curve(inputPoints, o) {
        if (inputPoints.length) {
            const p1 = inputPoints[0];
            const pointsList = (typeof p1[0] === 'number') ? [inputPoints] : inputPoints;
            const o1 = _curveWithOffset(pointsList[0], 1 * (1 + o.roughness * 0.2), o);
            const o2 = o.disableMultiStroke ? [] : _curveWithOffset(pointsList[0], 1.5 * (1 + o.roughness * 0.22), cloneOptionsAlterSeed(o));
            for (let i = 1; i < pointsList.length; i++) {
                const points = pointsList[i];
                if (points.length) {
                    const underlay = _curveWithOffset(points, 1 * (1 + o.roughness * 0.2), o);
                    const overlay = o.disableMultiStroke ? [] : _curveWithOffset(points, 1.5 * (1 + o.roughness * 0.22), cloneOptionsAlterSeed(o));
                    for (const item of underlay) {
                        if (item.op !== 'move') {
                            o1.push(item);
                        }
                    }
                    for (const item of overlay) {
                        if (item.op !== 'move') {
                            o2.push(item);
                        }
                    }
                }
            }
            return { type: 'path', ops: o1.concat(o2) };
        }
        return { type: 'path', ops: [] };
    }
    function ellipse(x, y, width, height, o) {
        const params = generateEllipseParams(width, height, o);
        return ellipseWithParams(x, y, o, params).opset;
    }
    function generateEllipseParams(width, height, o) {
        const psq = Math.sqrt(Math.PI * 2 * Math.sqrt((Math.pow(width / 2, 2) + Math.pow(height / 2, 2)) / 2));
        const stepCount = Math.ceil(Math.max(o.curveStepCount, (o.curveStepCount / Math.sqrt(200)) * psq));
        const increment = (Math.PI * 2) / stepCount;
        let rx = Math.abs(width / 2);
        let ry = Math.abs(height / 2);
        const curveFitRandomness = 1 - o.curveFitting;
        rx += _offsetOpt(rx * curveFitRandomness, o);
        ry += _offsetOpt(ry * curveFitRandomness, o);
        return { increment, rx, ry };
    }
    function ellipseWithParams(x, y, o, ellipseParams) {
        const [ap1, cp1] = _computeEllipsePoints(ellipseParams.increment, x, y, ellipseParams.rx, ellipseParams.ry, 1, ellipseParams.increment * _offset(0.1, _offset(0.4, 1, o), o), o);
        let o1 = _curve(ap1, null, o);
        if ((!o.disableMultiStroke) && (o.roughness !== 0)) {
            const [ap2] = _computeEllipsePoints(ellipseParams.increment, x, y, ellipseParams.rx, ellipseParams.ry, 1.5, 0, o);
            const o2 = _curve(ap2, null, o);
            o1 = o1.concat(o2);
        }
        return {
            estimatedPoints: cp1,
            opset: { type: 'path', ops: o1 },
        };
    }
    function arc(x, y, width, height, start, stop, closed, roughClosure, o) {
        const cx = x;
        const cy = y;
        let rx = Math.abs(width / 2);
        let ry = Math.abs(height / 2);
        rx += _offsetOpt(rx * 0.01, o);
        ry += _offsetOpt(ry * 0.01, o);
        let strt = start;
        let stp = stop;
        while (strt < 0) {
            strt += Math.PI * 2;
            stp += Math.PI * 2;
        }
        if ((stp - strt) > (Math.PI * 2)) {
            strt = 0;
            stp = Math.PI * 2;
        }
        const ellipseInc = (Math.PI * 2) / o.curveStepCount;
        const arcInc = Math.min(ellipseInc / 2, (stp - strt) / 2);
        const ops = _arc(arcInc, cx, cy, rx, ry, strt, stp, 1, o);
        if (!o.disableMultiStroke) {
            const o2 = _arc(arcInc, cx, cy, rx, ry, strt, stp, 1.5, o);
            ops.push(...o2);
        }
        if (closed) {
            if (roughClosure) {
                ops.push(..._doubleLine(cx, cy, cx + rx * Math.cos(strt), cy + ry * Math.sin(strt), o), ..._doubleLine(cx, cy, cx + rx * Math.cos(stp), cy + ry * Math.sin(stp), o));
            }
            else {
                ops.push({ op: 'lineTo', data: [cx, cy] }, { op: 'lineTo', data: [cx + rx * Math.cos(strt), cy + ry * Math.sin(strt)] });
            }
        }
        return { type: 'path', ops };
    }
    function svgPath(path, o) {
        const segments = normalize(absolutize(parsePath(path)));
        const ops = [];
        let first = [0, 0];
        let current = [0, 0];
        for (const { key, data } of segments) {
            switch (key) {
                case 'M': {
                    current = [data[0], data[1]];
                    first = [data[0], data[1]];
                    break;
                }
                case 'L':
                    ops.push(..._doubleLine(current[0], current[1], data[0], data[1], o));
                    current = [data[0], data[1]];
                    break;
                case 'C': {
                    const [x1, y1, x2, y2, x, y] = data;
                    ops.push(..._bezierTo(x1, y1, x2, y2, x, y, current, o));
                    current = [x, y];
                    break;
                }
                case 'Z':
                    ops.push(..._doubleLine(current[0], current[1], first[0], first[1], o));
                    current = [first[0], first[1]];
                    break;
            }
        }
        return { type: 'path', ops };
    }
    // Fills
    function solidFillPolygon(polygonList, o) {
        const ops = [];
        for (const points of polygonList) {
            if (points.length) {
                const offset = o.maxRandomnessOffset || 0;
                const len = points.length;
                if (len > 2) {
                    ops.push({ op: 'move', data: [points[0][0] + _offsetOpt(offset, o), points[0][1] + _offsetOpt(offset, o)] });
                    for (let i = 1; i < len; i++) {
                        ops.push({ op: 'lineTo', data: [points[i][0] + _offsetOpt(offset, o), points[i][1] + _offsetOpt(offset, o)] });
                    }
                }
            }
        }
        return { type: 'fillPath', ops };
    }
    function patternFillPolygons(polygonList, o) {
        return getFiller(o, helper).fillPolygons(polygonList, o);
    }
    function patternFillArc(x, y, width, height, start, stop, o) {
        const cx = x;
        const cy = y;
        let rx = Math.abs(width / 2);
        let ry = Math.abs(height / 2);
        rx += _offsetOpt(rx * 0.01, o);
        ry += _offsetOpt(ry * 0.01, o);
        let strt = start;
        let stp = stop;
        while (strt < 0) {
            strt += Math.PI * 2;
            stp += Math.PI * 2;
        }
        if ((stp - strt) > (Math.PI * 2)) {
            strt = 0;
            stp = Math.PI * 2;
        }
        const increment = (stp - strt) / o.curveStepCount;
        const points = [];
        for (let angle = strt; angle <= stp; angle = angle + increment) {
            points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
        }
        points.push([cx + rx * Math.cos(stp), cy + ry * Math.sin(stp)]);
        points.push([cx, cy]);
        return patternFillPolygons([points], o);
    }
    function randOffset(x, o) {
        return _offsetOpt(x, o);
    }
    function randOffsetWithRange(min, max, o) {
        return _offset(min, max, o);
    }
    function doubleLineFillOps(x1, y1, x2, y2, o) {
        return _doubleLine(x1, y1, x2, y2, o, true);
    }
    // Private helpers
    function cloneOptionsAlterSeed(ops) {
        const result = Object.assign({}, ops);
        result.randomizer = undefined;
        if (ops.seed) {
            result.seed = ops.seed + 1;
        }
        return result;
    }
    function random(ops) {
        if (!ops.randomizer) {
            ops.randomizer = new Random(ops.seed || 0);
        }
        return ops.randomizer.next();
    }
    function _offset(min, max, ops, roughnessGain = 1) {
        return ops.roughness * roughnessGain * ((random(ops) * (max - min)) + min);
    }
    function _offsetOpt(x, ops, roughnessGain = 1) {
        return _offset(-x, x, ops, roughnessGain);
    }
    function _doubleLine(x1, y1, x2, y2, o, filling = false) {
        const singleStroke = filling ? o.disableMultiStrokeFill : o.disableMultiStroke;
        const o1 = _line(x1, y1, x2, y2, o, true, false);
        if (singleStroke) {
            return o1;
        }
        const o2 = _line(x1, y1, x2, y2, o, true, true);
        return o1.concat(o2);
    }
    function _line(x1, y1, x2, y2, o, move, overlay) {
        const lengthSq = Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2);
        const length = Math.sqrt(lengthSq);
        let roughnessGain = 1;
        if (length < 200) {
            roughnessGain = 1;
        }
        else if (length > 500) {
            roughnessGain = 0.4;
        }
        else {
            roughnessGain = (-0.0016668) * length + 1.233334;
        }
        let offset = o.maxRandomnessOffset || 0;
        if ((offset * offset * 100) > lengthSq) {
            offset = length / 10;
        }
        const halfOffset = offset / 2;
        const divergePoint = 0.2 + random(o) * 0.2;
        let midDispX = o.bowing * o.maxRandomnessOffset * (y2 - y1) / 200;
        let midDispY = o.bowing * o.maxRandomnessOffset * (x1 - x2) / 200;
        midDispX = _offsetOpt(midDispX, o, roughnessGain);
        midDispY = _offsetOpt(midDispY, o, roughnessGain);
        const ops = [];
        const randomHalf = () => _offsetOpt(halfOffset, o, roughnessGain);
        const randomFull = () => _offsetOpt(offset, o, roughnessGain);
        const preserveVertices = o.preserveVertices;
        {
            if (overlay) {
                ops.push({
                    op: 'move', data: [
                        x1 + (preserveVertices ? 0 : randomHalf()),
                        y1 + (preserveVertices ? 0 : randomHalf()),
                    ],
                });
            }
            else {
                ops.push({
                    op: 'move', data: [
                        x1 + (preserveVertices ? 0 : _offsetOpt(offset, o, roughnessGain)),
                        y1 + (preserveVertices ? 0 : _offsetOpt(offset, o, roughnessGain)),
                    ],
                });
            }
        }
        if (overlay) {
            ops.push({
                op: 'bcurveTo',
                data: [
                    midDispX + x1 + (x2 - x1) * divergePoint + randomHalf(),
                    midDispY + y1 + (y2 - y1) * divergePoint + randomHalf(),
                    midDispX + x1 + 2 * (x2 - x1) * divergePoint + randomHalf(),
                    midDispY + y1 + 2 * (y2 - y1) * divergePoint + randomHalf(),
                    x2 + (preserveVertices ? 0 : randomHalf()),
                    y2 + (preserveVertices ? 0 : randomHalf()),
                ],
            });
        }
        else {
            ops.push({
                op: 'bcurveTo',
                data: [
                    midDispX + x1 + (x2 - x1) * divergePoint + randomFull(),
                    midDispY + y1 + (y2 - y1) * divergePoint + randomFull(),
                    midDispX + x1 + 2 * (x2 - x1) * divergePoint + randomFull(),
                    midDispY + y1 + 2 * (y2 - y1) * divergePoint + randomFull(),
                    x2 + (preserveVertices ? 0 : randomFull()),
                    y2 + (preserveVertices ? 0 : randomFull()),
                ],
            });
        }
        return ops;
    }
    function _curveWithOffset(points, offset, o) {
        if (!points.length) {
            return [];
        }
        const ps = [];
        ps.push([
            points[0][0] + _offsetOpt(offset, o),
            points[0][1] + _offsetOpt(offset, o),
        ]);
        ps.push([
            points[0][0] + _offsetOpt(offset, o),
            points[0][1] + _offsetOpt(offset, o),
        ]);
        for (let i = 1; i < points.length; i++) {
            ps.push([
                points[i][0] + _offsetOpt(offset, o),
                points[i][1] + _offsetOpt(offset, o),
            ]);
            if (i === (points.length - 1)) {
                ps.push([
                    points[i][0] + _offsetOpt(offset, o),
                    points[i][1] + _offsetOpt(offset, o),
                ]);
            }
        }
        return _curve(ps, null, o);
    }
    function _curve(points, closePoint, o) {
        const len = points.length;
        const ops = [];
        if (len > 3) {
            const b = [];
            const s = 1 - o.curveTightness;
            ops.push({ op: 'move', data: [points[1][0], points[1][1]] });
            for (let i = 1; (i + 2) < len; i++) {
                const cachedVertArray = points[i];
                b[0] = [cachedVertArray[0], cachedVertArray[1]];
                b[1] = [cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6, cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6];
                b[2] = [points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6, points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6];
                b[3] = [points[i + 1][0], points[i + 1][1]];
                ops.push({ op: 'bcurveTo', data: [b[1][0], b[1][1], b[2][0], b[2][1], b[3][0], b[3][1]] });
            }
        }
        else if (len === 3) {
            ops.push({ op: 'move', data: [points[1][0], points[1][1]] });
            ops.push({
                op: 'bcurveTo',
                data: [
                    points[1][0], points[1][1],
                    points[2][0], points[2][1],
                    points[2][0], points[2][1],
                ],
            });
        }
        else if (len === 2) {
            ops.push(..._line(points[0][0], points[0][1], points[1][0], points[1][1], o, true, true));
        }
        return ops;
    }
    function _computeEllipsePoints(increment, cx, cy, rx, ry, offset, overlap, o) {
        const coreOnly = o.roughness === 0;
        const corePoints = [];
        const allPoints = [];
        if (coreOnly) {
            increment = increment / 4;
            allPoints.push([
                cx + rx * Math.cos(-increment),
                cy + ry * Math.sin(-increment),
            ]);
            for (let angle = 0; angle <= Math.PI * 2; angle = angle + increment) {
                const p = [
                    cx + rx * Math.cos(angle),
                    cy + ry * Math.sin(angle),
                ];
                corePoints.push(p);
                allPoints.push(p);
            }
            allPoints.push([
                cx + rx * Math.cos(0),
                cy + ry * Math.sin(0),
            ]);
            allPoints.push([
                cx + rx * Math.cos(increment),
                cy + ry * Math.sin(increment),
            ]);
        }
        else {
            const radOffset = _offsetOpt(0.5, o) - (Math.PI / 2);
            allPoints.push([
                _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset - increment),
                _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset - increment),
            ]);
            const endAngle = Math.PI * 2 + radOffset - 0.01;
            for (let angle = radOffset; angle < endAngle; angle = angle + increment) {
                const p = [
                    _offsetOpt(offset, o) + cx + rx * Math.cos(angle),
                    _offsetOpt(offset, o) + cy + ry * Math.sin(angle),
                ];
                corePoints.push(p);
                allPoints.push(p);
            }
            allPoints.push([
                _offsetOpt(offset, o) + cx + rx * Math.cos(radOffset + Math.PI * 2 + overlap * 0.5),
                _offsetOpt(offset, o) + cy + ry * Math.sin(radOffset + Math.PI * 2 + overlap * 0.5),
            ]);
            allPoints.push([
                _offsetOpt(offset, o) + cx + 0.98 * rx * Math.cos(radOffset + overlap),
                _offsetOpt(offset, o) + cy + 0.98 * ry * Math.sin(radOffset + overlap),
            ]);
            allPoints.push([
                _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset + overlap * 0.5),
                _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset + overlap * 0.5),
            ]);
        }
        return [allPoints, corePoints];
    }
    function _arc(increment, cx, cy, rx, ry, strt, stp, offset, o) {
        const radOffset = strt + _offsetOpt(0.1, o);
        const points = [];
        points.push([
            _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset - increment),
            _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset - increment),
        ]);
        for (let angle = radOffset; angle <= stp; angle = angle + increment) {
            points.push([
                _offsetOpt(offset, o) + cx + rx * Math.cos(angle),
                _offsetOpt(offset, o) + cy + ry * Math.sin(angle),
            ]);
        }
        points.push([
            cx + rx * Math.cos(stp),
            cy + ry * Math.sin(stp),
        ]);
        points.push([
            cx + rx * Math.cos(stp),
            cy + ry * Math.sin(stp),
        ]);
        return _curve(points, null, o);
    }
    function _bezierTo(x1, y1, x2, y2, x, y, current, o) {
        const ops = [];
        const ros = [o.maxRandomnessOffset || 1, (o.maxRandomnessOffset || 1) + 0.3];
        let f = [0, 0];
        const iterations = o.disableMultiStroke ? 1 : 2;
        const preserveVertices = o.preserveVertices;
        for (let i = 0; i < iterations; i++) {
            if (i === 0) {
                ops.push({ op: 'move', data: [current[0], current[1]] });
            }
            else {
                ops.push({ op: 'move', data: [current[0] + (preserveVertices ? 0 : _offsetOpt(ros[0], o)), current[1] + (preserveVertices ? 0 : _offsetOpt(ros[0], o))] });
            }
            f = preserveVertices ? [x, y] : [x + _offsetOpt(ros[i], o), y + _offsetOpt(ros[i], o)];
            ops.push({
                op: 'bcurveTo',
                data: [
                    x1 + _offsetOpt(ros[i], o), y1 + _offsetOpt(ros[i], o),
                    x2 + _offsetOpt(ros[i], o), y2 + _offsetOpt(ros[i], o),
                    f[0], f[1],
                ],
            });
        }
        return ops;
    }

    function clone(p) {
        return [...p];
    }
    function curveToBezier(pointsIn, curveTightness = 0) {
        const len = pointsIn.length;
        if (len < 3) {
            throw new Error('A curve must have at least three points.');
        }
        const out = [];
        if (len === 3) {
            out.push(clone(pointsIn[0]), clone(pointsIn[1]), clone(pointsIn[2]), clone(pointsIn[2]));
        }
        else {
            const points = [];
            points.push(pointsIn[0], pointsIn[0]);
            for (let i = 1; i < pointsIn.length; i++) {
                points.push(pointsIn[i]);
                if (i === (pointsIn.length - 1)) {
                    points.push(pointsIn[i]);
                }
            }
            const b = [];
            const s = 1 - curveTightness;
            out.push(clone(points[0]));
            for (let i = 1; (i + 2) < points.length; i++) {
                const cachedVertArray = points[i];
                b[0] = [cachedVertArray[0], cachedVertArray[1]];
                b[1] = [cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6, cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6];
                b[2] = [points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6, points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6];
                b[3] = [points[i + 1][0], points[i + 1][1]];
                out.push(b[1], b[2], b[3]);
            }
        }
        return out;
    }

    // distance between 2 points
    function distance(p1, p2) {
        return Math.sqrt(distanceSq(p1, p2));
    }
    // distance between 2 points squared
    function distanceSq(p1, p2) {
        return Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);
    }
    // Sistance squared from a point p to the line segment vw
    function distanceToSegmentSq(p, v, w) {
        const l2 = distanceSq(v, w);
        if (l2 === 0) {
            return distanceSq(p, v);
        }
        let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
        t = Math.max(0, Math.min(1, t));
        return distanceSq(p, lerp(v, w, t));
    }
    function lerp(a, b, t) {
        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
        ];
    }
    // Adapted from https://seant23.wordpress.com/2010/11/12/offset-bezier-curves/
    function flatness(points, offset) {
        const p1 = points[offset + 0];
        const p2 = points[offset + 1];
        const p3 = points[offset + 2];
        const p4 = points[offset + 3];
        let ux = 3 * p2[0] - 2 * p1[0] - p4[0];
        ux *= ux;
        let uy = 3 * p2[1] - 2 * p1[1] - p4[1];
        uy *= uy;
        let vx = 3 * p3[0] - 2 * p4[0] - p1[0];
        vx *= vx;
        let vy = 3 * p3[1] - 2 * p4[1] - p1[1];
        vy *= vy;
        if (ux < vx) {
            ux = vx;
        }
        if (uy < vy) {
            uy = vy;
        }
        return ux + uy;
    }
    function getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints) {
        const outPoints = newPoints || [];
        if (flatness(points, offset) < tolerance) {
            const p0 = points[offset + 0];
            if (outPoints.length) {
                const d = distance(outPoints[outPoints.length - 1], p0);
                if (d > 1) {
                    outPoints.push(p0);
                }
            }
            else {
                outPoints.push(p0);
            }
            outPoints.push(points[offset + 3]);
        }
        else {
            // subdivide
            const t = .5;
            const p1 = points[offset + 0];
            const p2 = points[offset + 1];
            const p3 = points[offset + 2];
            const p4 = points[offset + 3];
            const q1 = lerp(p1, p2, t);
            const q2 = lerp(p2, p3, t);
            const q3 = lerp(p3, p4, t);
            const r1 = lerp(q1, q2, t);
            const r2 = lerp(q2, q3, t);
            const red = lerp(r1, r2, t);
            getPointsOnBezierCurveWithSplitting([p1, q1, r1, red], 0, tolerance, outPoints);
            getPointsOnBezierCurveWithSplitting([red, r2, q3, p4], 0, tolerance, outPoints);
        }
        return outPoints;
    }
    function simplify(points, distance) {
        return simplifyPoints(points, 0, points.length, distance);
    }
    // Ramer–Douglas–Peucker algorithm
    // https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
    function simplifyPoints(points, start, end, epsilon, newPoints) {
        const outPoints = newPoints || [];
        // find the most distance point from the endpoints
        const s = points[start];
        const e = points[end - 1];
        let maxDistSq = 0;
        let maxNdx = 1;
        for (let i = start + 1; i < end - 1; ++i) {
            const distSq = distanceToSegmentSq(points[i], s, e);
            if (distSq > maxDistSq) {
                maxDistSq = distSq;
                maxNdx = i;
            }
        }
        // if that point is too far, split
        if (Math.sqrt(maxDistSq) > epsilon) {
            simplifyPoints(points, start, maxNdx + 1, epsilon, outPoints);
            simplifyPoints(points, maxNdx, end, epsilon, outPoints);
        }
        else {
            if (!outPoints.length) {
                outPoints.push(s);
            }
            outPoints.push(e);
        }
        return outPoints;
    }
    function pointsOnBezierCurves(points, tolerance = 0.15, distance) {
        const newPoints = [];
        const numSegments = (points.length - 1) / 3;
        for (let i = 0; i < numSegments; i++) {
            const offset = i * 3;
            getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints);
        }
        if (distance && distance > 0) {
            return simplifyPoints(newPoints, 0, newPoints.length, distance);
        }
        return newPoints;
    }

    function pointsOnPath(path, tolerance, distance) {
        const segments = parsePath(path);
        const normalized = normalize(absolutize(segments));
        const sets = [];
        let currentPoints = [];
        let start = [0, 0];
        let pendingCurve = [];
        const appendPendingCurve = () => {
            if (pendingCurve.length >= 4) {
                currentPoints.push(...pointsOnBezierCurves(pendingCurve, tolerance));
            }
            pendingCurve = [];
        };
        const appendPendingPoints = () => {
            appendPendingCurve();
            if (currentPoints.length) {
                sets.push(currentPoints);
                currentPoints = [];
            }
        };
        for (const { key, data } of normalized) {
            switch (key) {
                case 'M':
                    appendPendingPoints();
                    start = [data[0], data[1]];
                    currentPoints.push(start);
                    break;
                case 'L':
                    appendPendingCurve();
                    currentPoints.push([data[0], data[1]]);
                    break;
                case 'C':
                    if (!pendingCurve.length) {
                        const lastPoint = currentPoints.length ? currentPoints[currentPoints.length - 1] : start;
                        pendingCurve.push([lastPoint[0], lastPoint[1]]);
                    }
                    pendingCurve.push([data[0], data[1]]);
                    pendingCurve.push([data[2], data[3]]);
                    pendingCurve.push([data[4], data[5]]);
                    break;
                case 'Z':
                    appendPendingCurve();
                    currentPoints.push([start[0], start[1]]);
                    break;
            }
        }
        appendPendingPoints();
        if (!distance) {
            return sets;
        }
        const out = [];
        for (const set of sets) {
            const simplifiedSet = simplify(set, distance);
            if (simplifiedSet.length) {
                out.push(simplifiedSet);
            }
        }
        return out;
    }

    const NOS = 'none';
    class RoughGenerator {
        constructor(config) {
            this.defaultOptions = {
                maxRandomnessOffset: 2,
                roughness: 1,
                bowing: 1,
                stroke: '#000',
                strokeWidth: 1,
                curveTightness: 0,
                curveFitting: 0.95,
                curveStepCount: 9,
                fillStyle: 'hachure',
                fillWeight: -1,
                hachureAngle: -41,
                hachureGap: -1,
                dashOffset: -1,
                dashGap: -1,
                zigzagOffset: -1,
                seed: 0,
                disableMultiStroke: false,
                disableMultiStrokeFill: false,
                preserveVertices: false,
                fillShapeRoughnessGain: 0.8,
            };
            this.config = config || {};
            if (this.config.options) {
                this.defaultOptions = this._o(this.config.options);
            }
        }
        static newSeed() {
            return randomSeed();
        }
        _o(options) {
            return options ? Object.assign({}, this.defaultOptions, options) : this.defaultOptions;
        }
        _d(shape, sets, options) {
            return { shape, sets: sets || [], options: options || this.defaultOptions };
        }
        line(x1, y1, x2, y2, options) {
            const o = this._o(options);
            return this._d('line', [line(x1, y1, x2, y2, o)], o);
        }
        rectangle(x, y, width, height, options) {
            const o = this._o(options);
            const paths = [];
            const outline = rectangle(x, y, width, height, o);
            if (o.fill) {
                const points = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
                if (o.fillStyle === 'solid') {
                    paths.push(solidFillPolygon([points], o));
                }
                else {
                    paths.push(patternFillPolygons([points], o));
                }
            }
            if (o.stroke !== NOS) {
                paths.push(outline);
            }
            return this._d('rectangle', paths, o);
        }
        ellipse(x, y, width, height, options) {
            const o = this._o(options);
            const paths = [];
            const ellipseParams = generateEllipseParams(width, height, o);
            const ellipseResponse = ellipseWithParams(x, y, o, ellipseParams);
            if (o.fill) {
                if (o.fillStyle === 'solid') {
                    const shape = ellipseWithParams(x, y, o, ellipseParams).opset;
                    shape.type = 'fillPath';
                    paths.push(shape);
                }
                else {
                    paths.push(patternFillPolygons([ellipseResponse.estimatedPoints], o));
                }
            }
            if (o.stroke !== NOS) {
                paths.push(ellipseResponse.opset);
            }
            return this._d('ellipse', paths, o);
        }
        circle(x, y, diameter, options) {
            const ret = this.ellipse(x, y, diameter, diameter, options);
            ret.shape = 'circle';
            return ret;
        }
        linearPath(points, options) {
            const o = this._o(options);
            return this._d('linearPath', [linearPath(points, false, o)], o);
        }
        arc(x, y, width, height, start, stop, closed = false, options) {
            const o = this._o(options);
            const paths = [];
            const outline = arc(x, y, width, height, start, stop, closed, true, o);
            if (closed && o.fill) {
                if (o.fillStyle === 'solid') {
                    const fillOptions = Object.assign({}, o);
                    fillOptions.disableMultiStroke = true;
                    const shape = arc(x, y, width, height, start, stop, true, false, fillOptions);
                    shape.type = 'fillPath';
                    paths.push(shape);
                }
                else {
                    paths.push(patternFillArc(x, y, width, height, start, stop, o));
                }
            }
            if (o.stroke !== NOS) {
                paths.push(outline);
            }
            return this._d('arc', paths, o);
        }
        curve(points, options) {
            const o = this._o(options);
            const paths = [];
            const outline = curve(points, o);
            if (o.fill && o.fill !== NOS) {
                if (o.fillStyle === 'solid') {
                    const fillShape = curve(points, Object.assign(Object.assign({}, o), { disableMultiStroke: true, roughness: o.roughness ? (o.roughness + o.fillShapeRoughnessGain) : 0 }));
                    paths.push({
                        type: 'fillPath',
                        ops: this._mergedShape(fillShape.ops),
                    });
                }
                else {
                    const polyPoints = [];
                    const inputPoints = points;
                    if (inputPoints.length) {
                        const p1 = inputPoints[0];
                        const pointsList = (typeof p1[0] === 'number') ? [inputPoints] : inputPoints;
                        for (const points of pointsList) {
                            if (points.length < 3) {
                                polyPoints.push(...points);
                            }
                            else if (points.length === 3) {
                                polyPoints.push(...pointsOnBezierCurves(curveToBezier([
                                    points[0],
                                    points[0],
                                    points[1],
                                    points[2],
                                ]), 10, (1 + o.roughness) / 2));
                            }
                            else {
                                polyPoints.push(...pointsOnBezierCurves(curveToBezier(points), 10, (1 + o.roughness) / 2));
                            }
                        }
                    }
                    if (polyPoints.length) {
                        paths.push(patternFillPolygons([polyPoints], o));
                    }
                }
            }
            if (o.stroke !== NOS) {
                paths.push(outline);
            }
            return this._d('curve', paths, o);
        }
        polygon(points, options) {
            const o = this._o(options);
            const paths = [];
            const outline = linearPath(points, true, o);
            if (o.fill) {
                if (o.fillStyle === 'solid') {
                    paths.push(solidFillPolygon([points], o));
                }
                else {
                    paths.push(patternFillPolygons([points], o));
                }
            }
            if (o.stroke !== NOS) {
                paths.push(outline);
            }
            return this._d('polygon', paths, o);
        }
        path(d, options) {
            const o = this._o(options);
            const paths = [];
            if (!d) {
                return this._d('path', paths, o);
            }
            d = (d || '').replace(/\n/g, ' ').replace(/(-\s)/g, '-').replace('/(\s\s)/g', ' ');
            const hasFill = o.fill && o.fill !== 'transparent' && o.fill !== NOS;
            const hasStroke = o.stroke !== NOS;
            const simplified = !!(o.simplification && (o.simplification < 1));
            const distance = simplified ? (4 - 4 * (o.simplification || 1)) : ((1 + o.roughness) / 2);
            const sets = pointsOnPath(d, 1, distance);
            const shape = svgPath(d, o);
            if (hasFill) {
                if (o.fillStyle === 'solid') {
                    if (sets.length === 1) {
                        const fillShape = svgPath(d, Object.assign(Object.assign({}, o), { disableMultiStroke: true, roughness: o.roughness ? (o.roughness + o.fillShapeRoughnessGain) : 0 }));
                        paths.push({
                            type: 'fillPath',
                            ops: this._mergedShape(fillShape.ops),
                        });
                    }
                    else {
                        paths.push(solidFillPolygon(sets, o));
                    }
                }
                else {
                    paths.push(patternFillPolygons(sets, o));
                }
            }
            if (hasStroke) {
                if (simplified) {
                    sets.forEach((set) => {
                        paths.push(linearPath(set, false, o));
                    });
                }
                else {
                    paths.push(shape);
                }
            }
            return this._d('path', paths, o);
        }
        opsToPath(drawing, fixedDecimals) {
            let path = '';
            for (const item of drawing.ops) {
                const data = ((typeof fixedDecimals === 'number') && fixedDecimals >= 0) ? (item.data.map((d) => +d.toFixed(fixedDecimals))) : item.data;
                switch (item.op) {
                    case 'move':
                        path += `M${data[0]} ${data[1]} `;
                        break;
                    case 'bcurveTo':
                        path += `C${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `;
                        break;
                    case 'lineTo':
                        path += `L${data[0]} ${data[1]} `;
                        break;
                }
            }
            return path.trim();
        }
        toPaths(drawable) {
            const sets = drawable.sets || [];
            const o = drawable.options || this.defaultOptions;
            const paths = [];
            for (const drawing of sets) {
                let path = null;
                switch (drawing.type) {
                    case 'path':
                        path = {
                            d: this.opsToPath(drawing),
                            stroke: o.stroke,
                            strokeWidth: o.strokeWidth,
                            fill: NOS,
                        };
                        break;
                    case 'fillPath':
                        path = {
                            d: this.opsToPath(drawing),
                            stroke: NOS,
                            strokeWidth: 0,
                            fill: o.fill || NOS,
                        };
                        break;
                    case 'fillSketch':
                        path = this.fillSketch(drawing, o);
                        break;
                }
                if (path) {
                    paths.push(path);
                }
            }
            return paths;
        }
        fillSketch(drawing, o) {
            let fweight = o.fillWeight;
            if (fweight < 0) {
                fweight = o.strokeWidth / 2;
            }
            return {
                d: this.opsToPath(drawing),
                stroke: o.fill || NOS,
                strokeWidth: fweight,
                fill: NOS,
            };
        }
        _mergedShape(input) {
            return input.filter((d, i) => {
                if (i === 0) {
                    return true;
                }
                if (d.op === 'move') {
                    return false;
                }
                return true;
            });
        }
    }

    class RoughCanvas {
        constructor(canvas, config) {
            this.canvas = canvas;
            this.ctx = this.canvas.getContext('2d');
            this.gen = new RoughGenerator(config);
        }
        draw(drawable) {
            const sets = drawable.sets || [];
            const o = drawable.options || this.getDefaultOptions();
            const ctx = this.ctx;
            const precision = drawable.options.fixedDecimalPlaceDigits;
            for (const drawing of sets) {
                switch (drawing.type) {
                    case 'path':
                        ctx.save();
                        ctx.strokeStyle = o.stroke === 'none' ? 'transparent' : o.stroke;
                        ctx.lineWidth = o.strokeWidth;
                        if (o.strokeLineDash) {
                            ctx.setLineDash(o.strokeLineDash);
                        }
                        if (o.strokeLineDashOffset) {
                            ctx.lineDashOffset = o.strokeLineDashOffset;
                        }
                        this._drawToContext(ctx, drawing, precision);
                        ctx.restore();
                        break;
                    case 'fillPath': {
                        ctx.save();
                        ctx.fillStyle = o.fill || '';
                        const fillRule = (drawable.shape === 'curve' || drawable.shape === 'polygon' || drawable.shape === 'path') ? 'evenodd' : 'nonzero';
                        this._drawToContext(ctx, drawing, precision, fillRule);
                        ctx.restore();
                        break;
                    }
                    case 'fillSketch':
                        this.fillSketch(ctx, drawing, o);
                        break;
                }
            }
        }
        fillSketch(ctx, drawing, o) {
            let fweight = o.fillWeight;
            if (fweight < 0) {
                fweight = o.strokeWidth / 2;
            }
            ctx.save();
            if (o.fillLineDash) {
                ctx.setLineDash(o.fillLineDash);
            }
            if (o.fillLineDashOffset) {
                ctx.lineDashOffset = o.fillLineDashOffset;
            }
            ctx.strokeStyle = o.fill || '';
            ctx.lineWidth = fweight;
            this._drawToContext(ctx, drawing, o.fixedDecimalPlaceDigits);
            ctx.restore();
        }
        _drawToContext(ctx, drawing, fixedDecimals, rule = 'nonzero') {
            ctx.beginPath();
            for (const item of drawing.ops) {
                const data = ((typeof fixedDecimals === 'number') && fixedDecimals >= 0) ? (item.data.map((d) => +d.toFixed(fixedDecimals))) : item.data;
                switch (item.op) {
                    case 'move':
                        ctx.moveTo(data[0], data[1]);
                        break;
                    case 'bcurveTo':
                        ctx.bezierCurveTo(data[0], data[1], data[2], data[3], data[4], data[5]);
                        break;
                    case 'lineTo':
                        ctx.lineTo(data[0], data[1]);
                        break;
                }
            }
            if (drawing.type === 'fillPath') {
                ctx.fill(rule);
            }
            else {
                ctx.stroke();
            }
        }
        get generator() {
            return this.gen;
        }
        getDefaultOptions() {
            return this.gen.defaultOptions;
        }
        line(x1, y1, x2, y2, options) {
            const d = this.gen.line(x1, y1, x2, y2, options);
            this.draw(d);
            return d;
        }
        rectangle(x, y, width, height, options) {
            const d = this.gen.rectangle(x, y, width, height, options);
            this.draw(d);
            return d;
        }
        ellipse(x, y, width, height, options) {
            const d = this.gen.ellipse(x, y, width, height, options);
            this.draw(d);
            return d;
        }
        circle(x, y, diameter, options) {
            const d = this.gen.circle(x, y, diameter, options);
            this.draw(d);
            return d;
        }
        linearPath(points, options) {
            const d = this.gen.linearPath(points, options);
            this.draw(d);
            return d;
        }
        polygon(points, options) {
            const d = this.gen.polygon(points, options);
            this.draw(d);
            return d;
        }
        arc(x, y, width, height, start, stop, closed = false, options) {
            const d = this.gen.arc(x, y, width, height, start, stop, closed, options);
            this.draw(d);
            return d;
        }
        curve(points, options) {
            const d = this.gen.curve(points, options);
            this.draw(d);
            return d;
        }
        path(d, options) {
            const drawing = this.gen.path(d, options);
            this.draw(drawing);
            return drawing;
        }
    }

    const SVGNS = 'http://www.w3.org/2000/svg';

    class RoughSVG {
        constructor(svg, config) {
            this.svg = svg;
            this.gen = new RoughGenerator(config);
        }
        draw(drawable) {
            const sets = drawable.sets || [];
            const o = drawable.options || this.getDefaultOptions();
            const doc = this.svg.ownerDocument || window.document;
            const g = doc.createElementNS(SVGNS, 'g');
            const precision = drawable.options.fixedDecimalPlaceDigits;
            for (const drawing of sets) {
                let path = null;
                switch (drawing.type) {
                    case 'path': {
                        path = doc.createElementNS(SVGNS, 'path');
                        path.setAttribute('d', this.opsToPath(drawing, precision));
                        path.setAttribute('stroke', o.stroke);
                        path.setAttribute('stroke-width', o.strokeWidth + '');
                        path.setAttribute('fill', 'none');
                        if (o.strokeLineDash) {
                            path.setAttribute('stroke-dasharray', o.strokeLineDash.join(' ').trim());
                        }
                        if (o.strokeLineDashOffset) {
                            path.setAttribute('stroke-dashoffset', `${o.strokeLineDashOffset}`);
                        }
                        break;
                    }
                    case 'fillPath': {
                        path = doc.createElementNS(SVGNS, 'path');
                        path.setAttribute('d', this.opsToPath(drawing, precision));
                        path.setAttribute('stroke', 'none');
                        path.setAttribute('stroke-width', '0');
                        path.setAttribute('fill', o.fill || '');
                        if (drawable.shape === 'curve' || drawable.shape === 'polygon') {
                            path.setAttribute('fill-rule', 'evenodd');
                        }
                        break;
                    }
                    case 'fillSketch': {
                        path = this.fillSketch(doc, drawing, o);
                        break;
                    }
                }
                if (path) {
                    g.appendChild(path);
                }
            }
            return g;
        }
        fillSketch(doc, drawing, o) {
            let fweight = o.fillWeight;
            if (fweight < 0) {
                fweight = o.strokeWidth / 2;
            }
            const path = doc.createElementNS(SVGNS, 'path');
            path.setAttribute('d', this.opsToPath(drawing, o.fixedDecimalPlaceDigits));
            path.setAttribute('stroke', o.fill || '');
            path.setAttribute('stroke-width', fweight + '');
            path.setAttribute('fill', 'none');
            if (o.fillLineDash) {
                path.setAttribute('stroke-dasharray', o.fillLineDash.join(' ').trim());
            }
            if (o.fillLineDashOffset) {
                path.setAttribute('stroke-dashoffset', `${o.fillLineDashOffset}`);
            }
            return path;
        }
        get generator() {
            return this.gen;
        }
        getDefaultOptions() {
            return this.gen.defaultOptions;
        }
        opsToPath(drawing, fixedDecimalPlaceDigits) {
            return this.gen.opsToPath(drawing, fixedDecimalPlaceDigits);
        }
        line(x1, y1, x2, y2, options) {
            const d = this.gen.line(x1, y1, x2, y2, options);
            return this.draw(d);
        }
        rectangle(x, y, width, height, options) {
            const d = this.gen.rectangle(x, y, width, height, options);
            return this.draw(d);
        }
        ellipse(x, y, width, height, options) {
            const d = this.gen.ellipse(x, y, width, height, options);
            return this.draw(d);
        }
        circle(x, y, diameter, options) {
            const d = this.gen.circle(x, y, diameter, options);
            return this.draw(d);
        }
        linearPath(points, options) {
            const d = this.gen.linearPath(points, options);
            return this.draw(d);
        }
        polygon(points, options) {
            const d = this.gen.polygon(points, options);
            return this.draw(d);
        }
        arc(x, y, width, height, start, stop, closed = false, options) {
            const d = this.gen.arc(x, y, width, height, start, stop, closed, options);
            return this.draw(d);
        }
        curve(points, options) {
            const d = this.gen.curve(points, options);
            return this.draw(d);
        }
        path(d, options) {
            const drawing = this.gen.path(d, options);
            return this.draw(drawing);
        }
    }

    var rough = {
        canvas(canvas, config) {
            return new RoughCanvas(canvas, config);
        },
        svg(svg, config) {
            return new RoughSVG(svg, config);
        },
        generator(config) {
            return new RoughGenerator(config);
        },
        newSeed() {
            return RoughGenerator.newSeed();
        },
    };

    exports.OutputType = void 0;
    (function (OutputType) {
        OutputType[OutputType["SVG"] = 0] = "SVG";
        OutputType[OutputType["CANVAS"] = 1] = "CANVAS";
    })(exports.OutputType || (exports.OutputType = {}));

    /**
     * Returns the Node's children, since Node.prototype.children is not available on all browsers.
     * https://developer.mozilla.org/en-US/docs/Web/API/ParentNode/children
     */
    function getNodeChildren(element) {
        if (typeof element.children !== 'undefined') {
            return element.children;
        }
        let i = 0;
        let node;
        const nodes = element.childNodes;
        const children = [];
        while ((node = nodes[i++])) {
            if (node.nodeType === 1) {
                children.push(node);
            }
        }
        return children;
    }
    /**
     * IE doesn't support `element.parentElement` in SVG documents.
     * This helper utilizes `parentNode` and checks for the `nodeType`.
     */
    function getParentElement(node) {
        const parentNode = node.parentNode;
        if (parentNode && parentNode.nodeType === Node.ELEMENT_NODE) {
            return parentNode;
        }
        return null;
    }
    /**
     * Moves the child-nodes from the source to a new parent.
     */
    function reparentNodes(newParent, source) {
        while (source.firstChild) {
            newParent.append(source.firstChild);
        }
        return newParent;
    }
    /**
     * Returns the id from the url string
     */
    function getIdFromUrl(url) {
        if (url === null) {
            return null;
        }
        const result = /url\('#?(.*?)'\)/.exec(url) || /url\("#?(.*?)"\)/.exec(url) || /url\(#?(.*?)\)/.exec(url);
        if (result && result.length > 1) {
            return result[1];
        }
        return null;
    }

    /**
     * Attribute for storing the new clip-path IDs for the sketch output.
     */
    const SKETCH_CLIP_ATTRIBUTE = 'data-sketchy-clip-path';
    /**
     * Regexp that detects curved commands in path data.
     */
    const PATH_CURVES_REGEX = /[acsqt]/i;
    /**
     * Returns the <defs> element of the output SVG sketch.
     */
    function getDefsElement(context) {
        if (context.svgSketchDefs) {
            return context.svgSketchDefs;
        }
        const parent = context.svgSketch;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        if (parent.childElementCount > 0) {
            parent.insertBefore(defs, parent.firstElementChild);
        }
        else {
            parent.appendChild(defs);
        }
        context.svgSketchDefs = defs;
        return defs;
    }
    function getPointsArray(element) {
        const pointsAttr = element.getAttribute('points');
        if (!pointsAttr) {
            return [];
        }
        let coordinateRegexp;
        if (pointsAttr.indexOf(' ') > 0) {
            // just assume that the coordinates (or pairs) are separated with space
            coordinateRegexp = /\s+/g;
        }
        else {
            // there are no spaces, so assume comma separators
            coordinateRegexp = /,/g;
        }
        const pointList = pointsAttr.split(coordinateRegexp);
        const points = [];
        for (let i = 0; i < pointList.length; i++) {
            const currentEntry = pointList[i];
            const coordinates = currentEntry.split(',');
            if (coordinates.length === 2) {
                points.push({ x: parseFloat(coordinates[0]), y: parseFloat(coordinates[1]) });
            }
            else {
                // space as separators, take next entry as y coordinate
                const next = i + 1;
                if (next < pointList.length) {
                    points.push({ x: parseFloat(currentEntry), y: parseFloat(pointList[next]) });
                    // skip the next entry
                    i = next;
                }
            }
        }
        return points;
    }
    /**
     * Helper method to append the returned `SVGGElement` from Rough.js which
     * also post processes the result e.g. by applying the clip.
     */
    function appendSketchElement(context, element, sketchElement) {
        let sketch = sketchElement;
        // original element may have a clip-path
        const sketchClipPathId = element.getAttribute(SKETCH_CLIP_ATTRIBUTE);
        const applyPencilFilter = context.pencilFilter && element.tagName !== 'text';
        // wrap it in another container to safely apply post-processing attributes,
        // though avoid no-op <g> containers
        const isPlainContainer = sketch.tagName === 'g' && sketch.attributes.length === 0;
        if (!isPlainContainer && (sketchClipPathId || applyPencilFilter)) {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.appendChild(sketch);
            sketch = g;
        }
        if (sketchClipPathId) {
            sketch.setAttribute('clip-path', `url(#${sketchClipPathId})`);
            element.removeAttribute(SKETCH_CLIP_ATTRIBUTE);
        }
        if (applyPencilFilter) {
            sketch.setAttribute('filter', 'url(#pencilTextureFilter)');
        }
        context.svgSketch.appendChild(sketch);
    }
    /**
     * Helper method to sketch a path.
     * Paths with curves should utilize the preserverVertices option to avoid line disjoints.
     * For non-curved paths it looks nicer to actually allow these diskoints.
     * @returns Returns the sketched SVGElement
     */
    function sketchPath(context, path, options) {
        if (PATH_CURVES_REGEX.test(path)) {
            options = options ? Object.assign(Object.assign({}, options), { preserveVertices: true }) : { preserveVertices: true };
        }
        return context.rc.path(path, options);
    }
    /**
     * Helper funtion to sketch a DOM fragment.
     * Wraps the given element in an SVG and runs the processor on it to sketch the fragment.
     * The result is then unpacked and returned.
     */
    function sketchFragment(context, g, roughOverwrites) {
        const proxySource = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        proxySource.appendChild(g);
        const proxyContext = Object.assign(Object.assign({}, context), { sourceSvg: proxySource, svgSketch: document.createElementNS('http://www.w3.org/2000/svg', 'svg'), roughConfig: Object.assign(Object.assign({}, context.roughConfig), roughOverwrites) });
        proxyContext.processElement(proxyContext, g, null);
        return reparentNodes(document.createElementNS('http://www.w3.org/2000/svg', 'g'), proxyContext.svgSketch);
    }
    /**
     * Measures the text in the context of the sketchSvg to account for inherited text
     * attributes.
     * The given text element must be a child of the svgSketch.
     */
    function measureText({ svgSketch, svgSketchIsInDOM }, text) {
        const hiddenElementStyle = 'visibility:hidden;position:absolute;left:-100%;top-100%;';
        const origStyle = svgSketch.getAttribute('style');
        if (origStyle) {
            svgSketch.setAttribute('style', `${origStyle};${hiddenElementStyle}`);
        }
        else {
            svgSketch.setAttribute('style', hiddenElementStyle);
        }
        // the element must be in the DOM for getBBox
        const body = document.body;
        const previousParent = svgSketch.parentElement;
        if (!svgSketchIsInDOM) {
            body.appendChild(svgSketch);
        }
        const { width, height } = text.getBBox();
        // make sure to not change the DOM hierarchy of the element
        if (!svgSketchIsInDOM) {
            body.removeChild(svgSketch);
            if (previousParent) {
                previousParent.appendChild(svgSketch);
            }
        }
        if (origStyle) {
            svgSketch.setAttribute('style', origStyle);
        }
        else {
            svgSketch.removeAttribute('style');
        }
        return { w: width, h: height };
    }

    /**
     * Returns the attribute value of an element under consideration
     * of inherited attributes from the `parentElement`.
     * @param attributeName Name of the attribute to look up
     * @param currentUseCtx Consider different DOM hierarchy for use elements
     * @return attribute value if it exists
     */
    function getEffectiveAttribute(context, element, attributeName, currentUseCtx) {
        // getComputedStyle doesn't work for, e.g. <svg fill='rgba(...)'>
        let attr;
        if (!currentUseCtx) {
            attr =
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                getComputedStyle(element)[attributeName] || element.getAttribute(attributeName);
        }
        else {
            // use elements traverse a different parent-hierarchy, thus we cannot use getComputedStyle here
            attr = element.getAttribute(attributeName);
        }
        if (!attr) {
            let parent = getParentElement(element);
            const useCtx = currentUseCtx;
            let nextCtx = useCtx;
            if (useCtx && useCtx.referenced === element) {
                // switch context and traverse the use-element parent now
                parent = useCtx.root;
                nextCtx = useCtx.parentContext;
            }
            if (!parent || parent === context.sourceSvg) {
                return;
            }
            return getEffectiveAttribute(context, parent, attributeName, nextCtx);
        }
        return attr;
    }
    /**
     * Traverses the given elements hierarchy bottom-up to determine its effective
     * opacity attribute.
     * @param currentUseCtx Consider different DOM hierarchy for use elements
     */
    function getEffectiveElementOpacity(context, element, currentOpacity, currentUseCtx) {
        let attr;
        if (!currentUseCtx) {
            attr = getComputedStyle(element)['opacity'] || element.getAttribute('opacity');
        }
        else {
            // use elements traverse a different parent-hierarchy, thus we cannot use getComputedStyle here
            attr = element.getAttribute('opacity');
        }
        if (attr) {
            let elementOpacity = 1;
            if (attr.indexOf('%') !== -1) {
                elementOpacity = Math.min(1, Math.max(0, parseFloat(attr.substring(0, attr.length - 1)) / 100));
            }
            else {
                elementOpacity = Math.min(1, Math.max(0, parseFloat(attr)));
            }
            // combine opacities
            currentOpacity *= elementOpacity;
        }
        // traverse upwards to combine parent opacities as well
        let parent = getParentElement(element);
        const useCtx = currentUseCtx;
        let nextUseCtx = useCtx;
        if (useCtx && useCtx.referenced === element) {
            // switch context and traverse the use-element parent now
            parent = useCtx.root;
            nextUseCtx = useCtx.parentContext;
        }
        if (!parent || parent === context.sourceSvg) {
            return currentOpacity;
        }
        return getEffectiveElementOpacity(context, parent, currentOpacity, nextUseCtx);
    }

    /**
     * If the input element has a pattern stroke/fill, an additional element is added to the result,
     * which just provides the pattern storke/fill.
     * @param patternProxyCreator Should return the transformed `SVGElement` that holds the stroke/fill pattern.
     */
    function appendPatternPaint(context, sourceElement, patternProxyCreator) {
        const { fillId, strokeId } = getPatternPaintIds(context, sourceElement);
        if (fillId !== null || strokeId !== null) {
            // the additional element that should provide the pattern
            const patternProxy = patternProxyCreator();
            patternProxy.setAttribute('fill', fillId !== null ? `url(#${fillId})` : 'none');
            patternProxy.setAttribute('stroke', strokeId !== null ? `url(#${strokeId})` : 'none');
            const strokeWidth = getEffectiveAttribute(context, sourceElement, 'stroke-width', context.useElementContext);
            patternProxy.setAttribute('stroke-width', strokeWidth !== null && strokeWidth !== void 0 ? strokeWidth : '0');
            // append the proxy
            appendSketchElement(context, sourceElement, patternProxy);
            // add the pattern defs
            appendPatternDefsElement(context, fillId);
            appendPatternDefsElement(context, strokeId);
        }
    }
    /**
     * Returns the element's referenced fill and stroke pattern ids if there are any.
     */
    function getPatternPaintIds(context, element) {
        function getPatternId(attributeName) {
            const attr = element.getAttribute(attributeName);
            if (attr && attr.indexOf('url') !== -1) {
                const id = getIdFromUrl(attr);
                if (id) {
                    const paint = context.idElements[id];
                    if (paint instanceof SVGPatternElement) {
                        return id;
                    }
                }
            }
            return null;
        }
        return { fillId: getPatternId('fill'), strokeId: getPatternId('stroke') };
    }
    /**
     * Obtains the pattern fill element from the source SVG and provides it as defs element
     * in the output sketch element if missing.
     */
    function appendPatternDefsElement(context, patternId) {
        if (patternId === null) {
            return;
        }
        const sketchDefs = getDefsElement(context);
        const defId = `#${patternId}`;
        if (!sketchDefs.querySelector(defId)) {
            const sourceDefElement = context.sourceSvg.querySelector(defId);
            if (sourceDefElement) {
                if (!context.sketchPatterns) {
                    // just copy the pattern to the output
                    sketchDefs.appendChild(sourceDefElement.cloneNode(true));
                    return;
                }
                // create a proxy for the pattern element to be sketched separately
                const patternElement = reparentNodes(document.createElementNS('http://www.w3.org/2000/svg', 'g'), sourceDefElement.cloneNode(true));
                // sketch the pattern separately from the main processor loop
                const sketchPattern = sketchFragment(context, patternElement, {
                    // patterns usually don't benefit from too crazy sketch values due to their base-size
                    fillStyle: 'solid',
                    roughness: 0.5 // TODO ideally this should scale with the pattern's size
                });
                // move the result into an copy of the original def element
                const defElementRoot = sourceDefElement.cloneNode();
                sketchDefs.appendChild(reparentNodes(defElementRoot, sketchPattern));
            }
        }
    }

    // This file is autogenerated. It's used to publish ESM to npm.
    function _typeof(obj) {
      "@babel/helpers - typeof";

      return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) {
        return typeof obj;
      } : function (obj) {
        return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      }, _typeof(obj);
    }

    // https://github.com/bgrins/TinyColor
    // Brian Grinstead, MIT License

    var trimLeft = /^\s+/;
    var trimRight = /\s+$/;
    function tinycolor(color, opts) {
      color = color ? color : "";
      opts = opts || {};

      // If input is already a tinycolor, return itself
      if (color instanceof tinycolor) {
        return color;
      }
      // If we are called as a function, call using new instead
      if (!(this instanceof tinycolor)) {
        return new tinycolor(color, opts);
      }
      var rgb = inputToRGB(color);
      this._originalInput = color, this._r = rgb.r, this._g = rgb.g, this._b = rgb.b, this._a = rgb.a, this._roundA = Math.round(100 * this._a) / 100, this._format = opts.format || rgb.format;
      this._gradientType = opts.gradientType;

      // Don't let the range of [0,255] come back in [0,1].
      // Potentially lose a little bit of precision here, but will fix issues where
      // .5 gets interpreted as half of the total, instead of half of 1
      // If it was supposed to be 128, this was already taken care of by `inputToRgb`
      if (this._r < 1) this._r = Math.round(this._r);
      if (this._g < 1) this._g = Math.round(this._g);
      if (this._b < 1) this._b = Math.round(this._b);
      this._ok = rgb.ok;
    }
    tinycolor.prototype = {
      isDark: function isDark() {
        return this.getBrightness() < 128;
      },
      isLight: function isLight() {
        return !this.isDark();
      },
      isValid: function isValid() {
        return this._ok;
      },
      getOriginalInput: function getOriginalInput() {
        return this._originalInput;
      },
      getFormat: function getFormat() {
        return this._format;
      },
      getAlpha: function getAlpha() {
        return this._a;
      },
      getBrightness: function getBrightness() {
        //http://www.w3.org/TR/AERT#color-contrast
        var rgb = this.toRgb();
        return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      },
      getLuminance: function getLuminance() {
        //http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
        var rgb = this.toRgb();
        var RsRGB, GsRGB, BsRGB, R, G, B;
        RsRGB = rgb.r / 255;
        GsRGB = rgb.g / 255;
        BsRGB = rgb.b / 255;
        if (RsRGB <= 0.03928) R = RsRGB / 12.92;else R = Math.pow((RsRGB + 0.055) / 1.055, 2.4);
        if (GsRGB <= 0.03928) G = GsRGB / 12.92;else G = Math.pow((GsRGB + 0.055) / 1.055, 2.4);
        if (BsRGB <= 0.03928) B = BsRGB / 12.92;else B = Math.pow((BsRGB + 0.055) / 1.055, 2.4);
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
      },
      setAlpha: function setAlpha(value) {
        this._a = boundAlpha(value);
        this._roundA = Math.round(100 * this._a) / 100;
        return this;
      },
      toHsv: function toHsv() {
        var hsv = rgbToHsv(this._r, this._g, this._b);
        return {
          h: hsv.h * 360,
          s: hsv.s,
          v: hsv.v,
          a: this._a
        };
      },
      toHsvString: function toHsvString() {
        var hsv = rgbToHsv(this._r, this._g, this._b);
        var h = Math.round(hsv.h * 360),
          s = Math.round(hsv.s * 100),
          v = Math.round(hsv.v * 100);
        return this._a == 1 ? "hsv(" + h + ", " + s + "%, " + v + "%)" : "hsva(" + h + ", " + s + "%, " + v + "%, " + this._roundA + ")";
      },
      toHsl: function toHsl() {
        var hsl = rgbToHsl(this._r, this._g, this._b);
        return {
          h: hsl.h * 360,
          s: hsl.s,
          l: hsl.l,
          a: this._a
        };
      },
      toHslString: function toHslString() {
        var hsl = rgbToHsl(this._r, this._g, this._b);
        var h = Math.round(hsl.h * 360),
          s = Math.round(hsl.s * 100),
          l = Math.round(hsl.l * 100);
        return this._a == 1 ? "hsl(" + h + ", " + s + "%, " + l + "%)" : "hsla(" + h + ", " + s + "%, " + l + "%, " + this._roundA + ")";
      },
      toHex: function toHex(allow3Char) {
        return rgbToHex(this._r, this._g, this._b, allow3Char);
      },
      toHexString: function toHexString(allow3Char) {
        return "#" + this.toHex(allow3Char);
      },
      toHex8: function toHex8(allow4Char) {
        return rgbaToHex(this._r, this._g, this._b, this._a, allow4Char);
      },
      toHex8String: function toHex8String(allow4Char) {
        return "#" + this.toHex8(allow4Char);
      },
      toRgb: function toRgb() {
        return {
          r: Math.round(this._r),
          g: Math.round(this._g),
          b: Math.round(this._b),
          a: this._a
        };
      },
      toRgbString: function toRgbString() {
        return this._a == 1 ? "rgb(" + Math.round(this._r) + ", " + Math.round(this._g) + ", " + Math.round(this._b) + ")" : "rgba(" + Math.round(this._r) + ", " + Math.round(this._g) + ", " + Math.round(this._b) + ", " + this._roundA + ")";
      },
      toPercentageRgb: function toPercentageRgb() {
        return {
          r: Math.round(bound01(this._r, 255) * 100) + "%",
          g: Math.round(bound01(this._g, 255) * 100) + "%",
          b: Math.round(bound01(this._b, 255) * 100) + "%",
          a: this._a
        };
      },
      toPercentageRgbString: function toPercentageRgbString() {
        return this._a == 1 ? "rgb(" + Math.round(bound01(this._r, 255) * 100) + "%, " + Math.round(bound01(this._g, 255) * 100) + "%, " + Math.round(bound01(this._b, 255) * 100) + "%)" : "rgba(" + Math.round(bound01(this._r, 255) * 100) + "%, " + Math.round(bound01(this._g, 255) * 100) + "%, " + Math.round(bound01(this._b, 255) * 100) + "%, " + this._roundA + ")";
      },
      toName: function toName() {
        if (this._a === 0) {
          return "transparent";
        }
        if (this._a < 1) {
          return false;
        }
        return hexNames[rgbToHex(this._r, this._g, this._b, true)] || false;
      },
      toFilter: function toFilter(secondColor) {
        var hex8String = "#" + rgbaToArgbHex(this._r, this._g, this._b, this._a);
        var secondHex8String = hex8String;
        var gradientType = this._gradientType ? "GradientType = 1, " : "";
        if (secondColor) {
          var s = tinycolor(secondColor);
          secondHex8String = "#" + rgbaToArgbHex(s._r, s._g, s._b, s._a);
        }
        return "progid:DXImageTransform.Microsoft.gradient(" + gradientType + "startColorstr=" + hex8String + ",endColorstr=" + secondHex8String + ")";
      },
      toString: function toString(format) {
        var formatSet = !!format;
        format = format || this._format;
        var formattedString = false;
        var hasAlpha = this._a < 1 && this._a >= 0;
        var needsAlphaFormat = !formatSet && hasAlpha && (format === "hex" || format === "hex6" || format === "hex3" || format === "hex4" || format === "hex8" || format === "name");
        if (needsAlphaFormat) {
          // Special case for "transparent", all other non-alpha formats
          // will return rgba when there is transparency.
          if (format === "name" && this._a === 0) {
            return this.toName();
          }
          return this.toRgbString();
        }
        if (format === "rgb") {
          formattedString = this.toRgbString();
        }
        if (format === "prgb") {
          formattedString = this.toPercentageRgbString();
        }
        if (format === "hex" || format === "hex6") {
          formattedString = this.toHexString();
        }
        if (format === "hex3") {
          formattedString = this.toHexString(true);
        }
        if (format === "hex4") {
          formattedString = this.toHex8String(true);
        }
        if (format === "hex8") {
          formattedString = this.toHex8String();
        }
        if (format === "name") {
          formattedString = this.toName();
        }
        if (format === "hsl") {
          formattedString = this.toHslString();
        }
        if (format === "hsv") {
          formattedString = this.toHsvString();
        }
        return formattedString || this.toHexString();
      },
      clone: function clone() {
        return tinycolor(this.toString());
      },
      _applyModification: function _applyModification(fn, args) {
        var color = fn.apply(null, [this].concat([].slice.call(args)));
        this._r = color._r;
        this._g = color._g;
        this._b = color._b;
        this.setAlpha(color._a);
        return this;
      },
      lighten: function lighten() {
        return this._applyModification(_lighten, arguments);
      },
      brighten: function brighten() {
        return this._applyModification(_brighten, arguments);
      },
      darken: function darken() {
        return this._applyModification(_darken, arguments);
      },
      desaturate: function desaturate() {
        return this._applyModification(_desaturate, arguments);
      },
      saturate: function saturate() {
        return this._applyModification(_saturate, arguments);
      },
      greyscale: function greyscale() {
        return this._applyModification(_greyscale, arguments);
      },
      spin: function spin() {
        return this._applyModification(_spin, arguments);
      },
      _applyCombination: function _applyCombination(fn, args) {
        return fn.apply(null, [this].concat([].slice.call(args)));
      },
      analogous: function analogous() {
        return this._applyCombination(_analogous, arguments);
      },
      complement: function complement() {
        return this._applyCombination(_complement, arguments);
      },
      monochromatic: function monochromatic() {
        return this._applyCombination(_monochromatic, arguments);
      },
      splitcomplement: function splitcomplement() {
        return this._applyCombination(_splitcomplement, arguments);
      },
      // Disabled until https://github.com/bgrins/TinyColor/issues/254
      // polyad: function (number) {
      //   return this._applyCombination(polyad, [number]);
      // },
      triad: function triad() {
        return this._applyCombination(polyad, [3]);
      },
      tetrad: function tetrad() {
        return this._applyCombination(polyad, [4]);
      }
    };

    // If input is an object, force 1 into "1.0" to handle ratios properly
    // String input requires "1.0" as input, so 1 will be treated as 1
    tinycolor.fromRatio = function (color, opts) {
      if (_typeof(color) == "object") {
        var newColor = {};
        for (var i in color) {
          if (color.hasOwnProperty(i)) {
            if (i === "a") {
              newColor[i] = color[i];
            } else {
              newColor[i] = convertToPercentage(color[i]);
            }
          }
        }
        color = newColor;
      }
      return tinycolor(color, opts);
    };

    // Given a string or object, convert that input to RGB
    // Possible string inputs:
    //
    //     "red"
    //     "#f00" or "f00"
    //     "#ff0000" or "ff0000"
    //     "#ff000000" or "ff000000"
    //     "rgb 255 0 0" or "rgb (255, 0, 0)"
    //     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
    //     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
    //     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
    //     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
    //     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
    //     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
    //
    function inputToRGB(color) {
      var rgb = {
        r: 0,
        g: 0,
        b: 0
      };
      var a = 1;
      var s = null;
      var v = null;
      var l = null;
      var ok = false;
      var format = false;
      if (typeof color == "string") {
        color = stringInputToObject(color);
      }
      if (_typeof(color) == "object") {
        if (isValidCSSUnit(color.r) && isValidCSSUnit(color.g) && isValidCSSUnit(color.b)) {
          rgb = rgbToRgb(color.r, color.g, color.b);
          ok = true;
          format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
        } else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.v)) {
          s = convertToPercentage(color.s);
          v = convertToPercentage(color.v);
          rgb = hsvToRgb(color.h, s, v);
          ok = true;
          format = "hsv";
        } else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.l)) {
          s = convertToPercentage(color.s);
          l = convertToPercentage(color.l);
          rgb = hslToRgb(color.h, s, l);
          ok = true;
          format = "hsl";
        }
        if (color.hasOwnProperty("a")) {
          a = color.a;
        }
      }
      a = boundAlpha(a);
      return {
        ok: ok,
        format: color.format || format,
        r: Math.min(255, Math.max(rgb.r, 0)),
        g: Math.min(255, Math.max(rgb.g, 0)),
        b: Math.min(255, Math.max(rgb.b, 0)),
        a: a
      };
    }

    // Conversion Functions
    // --------------------

    // `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
    // <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

    // `rgbToRgb`
    // Handle bounds / percentage checking to conform to CSS color spec
    // <http://www.w3.org/TR/css3-color/>
    // *Assumes:* r, g, b in [0, 255] or [0, 1]
    // *Returns:* { r, g, b } in [0, 255]
    function rgbToRgb(r, g, b) {
      return {
        r: bound01(r, 255) * 255,
        g: bound01(g, 255) * 255,
        b: bound01(b, 255) * 255
      };
    }

    // `rgbToHsl`
    // Converts an RGB color value to HSL.
    // *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
    // *Returns:* { h, s, l } in [0,1]
    function rgbToHsl(r, g, b) {
      r = bound01(r, 255);
      g = bound01(g, 255);
      b = bound01(b, 255);
      var max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      var h,
        s,
        l = (max + min) / 2;
      if (max == min) {
        h = s = 0; // achromatic
      } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }
      return {
        h: h,
        s: s,
        l: l
      };
    }

    // `hslToRgb`
    // Converts an HSL color value to RGB.
    // *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
    // *Returns:* { r, g, b } in the set [0, 255]
    function hslToRgb(h, s, l) {
      var r, g, b;
      h = bound01(h, 360);
      s = bound01(s, 100);
      l = bound01(l, 100);
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }
      if (s === 0) {
        r = g = b = l; // achromatic
      } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      return {
        r: r * 255,
        g: g * 255,
        b: b * 255
      };
    }

    // `rgbToHsv`
    // Converts an RGB color value to HSV
    // *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
    // *Returns:* { h, s, v } in [0,1]
    function rgbToHsv(r, g, b) {
      r = bound01(r, 255);
      g = bound01(g, 255);
      b = bound01(b, 255);
      var max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      var h,
        s,
        v = max;
      var d = max - min;
      s = max === 0 ? 0 : d / max;
      if (max == min) {
        h = 0; // achromatic
      } else {
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }
      return {
        h: h,
        s: s,
        v: v
      };
    }

    // `hsvToRgb`
    // Converts an HSV color value to RGB.
    // *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
    // *Returns:* { r, g, b } in the set [0, 255]
    function hsvToRgb(h, s, v) {
      h = bound01(h, 360) * 6;
      s = bound01(s, 100);
      v = bound01(v, 100);
      var i = Math.floor(h),
        f = h - i,
        p = v * (1 - s),
        q = v * (1 - f * s),
        t = v * (1 - (1 - f) * s),
        mod = i % 6,
        r = [v, q, p, p, t, v][mod],
        g = [t, v, v, q, p, p][mod],
        b = [p, p, t, v, v, q][mod];
      return {
        r: r * 255,
        g: g * 255,
        b: b * 255
      };
    }

    // `rgbToHex`
    // Converts an RGB color to hex
    // Assumes r, g, and b are contained in the set [0, 255]
    // Returns a 3 or 6 character hex
    function rgbToHex(r, g, b, allow3Char) {
      var hex = [pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b).toString(16))];

      // Return a 3 character hex if possible
      if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
        return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
      }
      return hex.join("");
    }

    // `rgbaToHex`
    // Converts an RGBA color plus alpha transparency to hex
    // Assumes r, g, b are contained in the set [0, 255] and
    // a in [0, 1]. Returns a 4 or 8 character rgba hex
    function rgbaToHex(r, g, b, a, allow4Char) {
      var hex = [pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b).toString(16)), pad2(convertDecimalToHex(a))];

      // Return a 4 character hex if possible
      if (allow4Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1) && hex[3].charAt(0) == hex[3].charAt(1)) {
        return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0) + hex[3].charAt(0);
      }
      return hex.join("");
    }

    // `rgbaToArgbHex`
    // Converts an RGBA color to an ARGB Hex8 string
    // Rarely used, but required for "toFilter()"
    function rgbaToArgbHex(r, g, b, a) {
      var hex = [pad2(convertDecimalToHex(a)), pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b).toString(16))];
      return hex.join("");
    }

    // `equals`
    // Can be called with any tinycolor input
    tinycolor.equals = function (color1, color2) {
      if (!color1 || !color2) return false;
      return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
    };
    tinycolor.random = function () {
      return tinycolor.fromRatio({
        r: Math.random(),
        g: Math.random(),
        b: Math.random()
      });
    };

    // Modification Functions
    // ----------------------
    // Thanks to less.js for some of the basics here
    // <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>

    function _desaturate(color, amount) {
      amount = amount === 0 ? 0 : amount || 10;
      var hsl = tinycolor(color).toHsl();
      hsl.s -= amount / 100;
      hsl.s = clamp01(hsl.s);
      return tinycolor(hsl);
    }
    function _saturate(color, amount) {
      amount = amount === 0 ? 0 : amount || 10;
      var hsl = tinycolor(color).toHsl();
      hsl.s += amount / 100;
      hsl.s = clamp01(hsl.s);
      return tinycolor(hsl);
    }
    function _greyscale(color) {
      return tinycolor(color).desaturate(100);
    }
    function _lighten(color, amount) {
      amount = amount === 0 ? 0 : amount || 10;
      var hsl = tinycolor(color).toHsl();
      hsl.l += amount / 100;
      hsl.l = clamp01(hsl.l);
      return tinycolor(hsl);
    }
    function _brighten(color, amount) {
      amount = amount === 0 ? 0 : amount || 10;
      var rgb = tinycolor(color).toRgb();
      rgb.r = Math.max(0, Math.min(255, rgb.r - Math.round(255 * -(amount / 100))));
      rgb.g = Math.max(0, Math.min(255, rgb.g - Math.round(255 * -(amount / 100))));
      rgb.b = Math.max(0, Math.min(255, rgb.b - Math.round(255 * -(amount / 100))));
      return tinycolor(rgb);
    }
    function _darken(color, amount) {
      amount = amount === 0 ? 0 : amount || 10;
      var hsl = tinycolor(color).toHsl();
      hsl.l -= amount / 100;
      hsl.l = clamp01(hsl.l);
      return tinycolor(hsl);
    }

    // Spin takes a positive or negative amount within [-360, 360] indicating the change of hue.
    // Values outside of this range will be wrapped into this range.
    function _spin(color, amount) {
      var hsl = tinycolor(color).toHsl();
      var hue = (hsl.h + amount) % 360;
      hsl.h = hue < 0 ? 360 + hue : hue;
      return tinycolor(hsl);
    }

    // Combination Functions
    // ---------------------
    // Thanks to jQuery xColor for some of the ideas behind these
    // <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

    function _complement(color) {
      var hsl = tinycolor(color).toHsl();
      hsl.h = (hsl.h + 180) % 360;
      return tinycolor(hsl);
    }
    function polyad(color, number) {
      if (isNaN(number) || number <= 0) {
        throw new Error("Argument to polyad must be a positive number");
      }
      var hsl = tinycolor(color).toHsl();
      var result = [tinycolor(color)];
      var step = 360 / number;
      for (var i = 1; i < number; i++) {
        result.push(tinycolor({
          h: (hsl.h + i * step) % 360,
          s: hsl.s,
          l: hsl.l
        }));
      }
      return result;
    }
    function _splitcomplement(color) {
      var hsl = tinycolor(color).toHsl();
      var h = hsl.h;
      return [tinycolor(color), tinycolor({
        h: (h + 72) % 360,
        s: hsl.s,
        l: hsl.l
      }), tinycolor({
        h: (h + 216) % 360,
        s: hsl.s,
        l: hsl.l
      })];
    }
    function _analogous(color, results, slices) {
      results = results || 6;
      slices = slices || 30;
      var hsl = tinycolor(color).toHsl();
      var part = 360 / slices;
      var ret = [tinycolor(color)];
      for (hsl.h = (hsl.h - (part * results >> 1) + 720) % 360; --results;) {
        hsl.h = (hsl.h + part) % 360;
        ret.push(tinycolor(hsl));
      }
      return ret;
    }
    function _monochromatic(color, results) {
      results = results || 6;
      var hsv = tinycolor(color).toHsv();
      var h = hsv.h,
        s = hsv.s,
        v = hsv.v;
      var ret = [];
      var modification = 1 / results;
      while (results--) {
        ret.push(tinycolor({
          h: h,
          s: s,
          v: v
        }));
        v = (v + modification) % 1;
      }
      return ret;
    }

    // Utility Functions
    // ---------------------

    tinycolor.mix = function (color1, color2, amount) {
      amount = amount === 0 ? 0 : amount || 50;
      var rgb1 = tinycolor(color1).toRgb();
      var rgb2 = tinycolor(color2).toRgb();
      var p = amount / 100;
      var rgba = {
        r: (rgb2.r - rgb1.r) * p + rgb1.r,
        g: (rgb2.g - rgb1.g) * p + rgb1.g,
        b: (rgb2.b - rgb1.b) * p + rgb1.b,
        a: (rgb2.a - rgb1.a) * p + rgb1.a
      };
      return tinycolor(rgba);
    };

    // Readability Functions
    // ---------------------
    // <http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef (WCAG Version 2)

    // `contrast`
    // Analyze the 2 colors and returns the color contrast defined by (WCAG Version 2)
    tinycolor.readability = function (color1, color2) {
      var c1 = tinycolor(color1);
      var c2 = tinycolor(color2);
      return (Math.max(c1.getLuminance(), c2.getLuminance()) + 0.05) / (Math.min(c1.getLuminance(), c2.getLuminance()) + 0.05);
    };

    // `isReadable`
    // Ensure that foreground and background color combinations meet WCAG2 guidelines.
    // The third argument is an optional Object.
    //      the 'level' property states 'AA' or 'AAA' - if missing or invalid, it defaults to 'AA';
    //      the 'size' property states 'large' or 'small' - if missing or invalid, it defaults to 'small'.
    // If the entire object is absent, isReadable defaults to {level:"AA",size:"small"}.

    // *Example*
    //    tinycolor.isReadable("#000", "#111") => false
    //    tinycolor.isReadable("#000", "#111",{level:"AA",size:"large"}) => false
    tinycolor.isReadable = function (color1, color2, wcag2) {
      var readability = tinycolor.readability(color1, color2);
      var wcag2Parms, out;
      out = false;
      wcag2Parms = validateWCAG2Parms(wcag2);
      switch (wcag2Parms.level + wcag2Parms.size) {
        case "AAsmall":
        case "AAAlarge":
          out = readability >= 4.5;
          break;
        case "AAlarge":
          out = readability >= 3;
          break;
        case "AAAsmall":
          out = readability >= 7;
          break;
      }
      return out;
    };

    // `mostReadable`
    // Given a base color and a list of possible foreground or background
    // colors for that base, returns the most readable color.
    // Optionally returns Black or White if the most readable color is unreadable.
    // *Example*
    //    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:false}).toHexString(); // "#112255"
    //    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:true}).toHexString();  // "#ffffff"
    //    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"large"}).toHexString(); // "#faf3f3"
    //    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"small"}).toHexString(); // "#ffffff"
    tinycolor.mostReadable = function (baseColor, colorList, args) {
      var bestColor = null;
      var bestScore = 0;
      var readability;
      var includeFallbackColors, level, size;
      args = args || {};
      includeFallbackColors = args.includeFallbackColors;
      level = args.level;
      size = args.size;
      for (var i = 0; i < colorList.length; i++) {
        readability = tinycolor.readability(baseColor, colorList[i]);
        if (readability > bestScore) {
          bestScore = readability;
          bestColor = tinycolor(colorList[i]);
        }
      }
      if (tinycolor.isReadable(baseColor, bestColor, {
        level: level,
        size: size
      }) || !includeFallbackColors) {
        return bestColor;
      } else {
        args.includeFallbackColors = false;
        return tinycolor.mostReadable(baseColor, ["#fff", "#000"], args);
      }
    };

    // Big List of Colors
    // ------------------
    // <https://www.w3.org/TR/css-color-4/#named-colors>
    var names = tinycolor.names = {
      aliceblue: "f0f8ff",
      antiquewhite: "faebd7",
      aqua: "0ff",
      aquamarine: "7fffd4",
      azure: "f0ffff",
      beige: "f5f5dc",
      bisque: "ffe4c4",
      black: "000",
      blanchedalmond: "ffebcd",
      blue: "00f",
      blueviolet: "8a2be2",
      brown: "a52a2a",
      burlywood: "deb887",
      burntsienna: "ea7e5d",
      cadetblue: "5f9ea0",
      chartreuse: "7fff00",
      chocolate: "d2691e",
      coral: "ff7f50",
      cornflowerblue: "6495ed",
      cornsilk: "fff8dc",
      crimson: "dc143c",
      cyan: "0ff",
      darkblue: "00008b",
      darkcyan: "008b8b",
      darkgoldenrod: "b8860b",
      darkgray: "a9a9a9",
      darkgreen: "006400",
      darkgrey: "a9a9a9",
      darkkhaki: "bdb76b",
      darkmagenta: "8b008b",
      darkolivegreen: "556b2f",
      darkorange: "ff8c00",
      darkorchid: "9932cc",
      darkred: "8b0000",
      darksalmon: "e9967a",
      darkseagreen: "8fbc8f",
      darkslateblue: "483d8b",
      darkslategray: "2f4f4f",
      darkslategrey: "2f4f4f",
      darkturquoise: "00ced1",
      darkviolet: "9400d3",
      deeppink: "ff1493",
      deepskyblue: "00bfff",
      dimgray: "696969",
      dimgrey: "696969",
      dodgerblue: "1e90ff",
      firebrick: "b22222",
      floralwhite: "fffaf0",
      forestgreen: "228b22",
      fuchsia: "f0f",
      gainsboro: "dcdcdc",
      ghostwhite: "f8f8ff",
      gold: "ffd700",
      goldenrod: "daa520",
      gray: "808080",
      green: "008000",
      greenyellow: "adff2f",
      grey: "808080",
      honeydew: "f0fff0",
      hotpink: "ff69b4",
      indianred: "cd5c5c",
      indigo: "4b0082",
      ivory: "fffff0",
      khaki: "f0e68c",
      lavender: "e6e6fa",
      lavenderblush: "fff0f5",
      lawngreen: "7cfc00",
      lemonchiffon: "fffacd",
      lightblue: "add8e6",
      lightcoral: "f08080",
      lightcyan: "e0ffff",
      lightgoldenrodyellow: "fafad2",
      lightgray: "d3d3d3",
      lightgreen: "90ee90",
      lightgrey: "d3d3d3",
      lightpink: "ffb6c1",
      lightsalmon: "ffa07a",
      lightseagreen: "20b2aa",
      lightskyblue: "87cefa",
      lightslategray: "789",
      lightslategrey: "789",
      lightsteelblue: "b0c4de",
      lightyellow: "ffffe0",
      lime: "0f0",
      limegreen: "32cd32",
      linen: "faf0e6",
      magenta: "f0f",
      maroon: "800000",
      mediumaquamarine: "66cdaa",
      mediumblue: "0000cd",
      mediumorchid: "ba55d3",
      mediumpurple: "9370db",
      mediumseagreen: "3cb371",
      mediumslateblue: "7b68ee",
      mediumspringgreen: "00fa9a",
      mediumturquoise: "48d1cc",
      mediumvioletred: "c71585",
      midnightblue: "191970",
      mintcream: "f5fffa",
      mistyrose: "ffe4e1",
      moccasin: "ffe4b5",
      navajowhite: "ffdead",
      navy: "000080",
      oldlace: "fdf5e6",
      olive: "808000",
      olivedrab: "6b8e23",
      orange: "ffa500",
      orangered: "ff4500",
      orchid: "da70d6",
      palegoldenrod: "eee8aa",
      palegreen: "98fb98",
      paleturquoise: "afeeee",
      palevioletred: "db7093",
      papayawhip: "ffefd5",
      peachpuff: "ffdab9",
      peru: "cd853f",
      pink: "ffc0cb",
      plum: "dda0dd",
      powderblue: "b0e0e6",
      purple: "800080",
      rebeccapurple: "663399",
      red: "f00",
      rosybrown: "bc8f8f",
      royalblue: "4169e1",
      saddlebrown: "8b4513",
      salmon: "fa8072",
      sandybrown: "f4a460",
      seagreen: "2e8b57",
      seashell: "fff5ee",
      sienna: "a0522d",
      silver: "c0c0c0",
      skyblue: "87ceeb",
      slateblue: "6a5acd",
      slategray: "708090",
      slategrey: "708090",
      snow: "fffafa",
      springgreen: "00ff7f",
      steelblue: "4682b4",
      tan: "d2b48c",
      teal: "008080",
      thistle: "d8bfd8",
      tomato: "ff6347",
      turquoise: "40e0d0",
      violet: "ee82ee",
      wheat: "f5deb3",
      white: "fff",
      whitesmoke: "f5f5f5",
      yellow: "ff0",
      yellowgreen: "9acd32"
    };

    // Make it easy to access colors via `hexNames[hex]`
    var hexNames = tinycolor.hexNames = flip(names);

    // Utilities
    // ---------

    // `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
    function flip(o) {
      var flipped = {};
      for (var i in o) {
        if (o.hasOwnProperty(i)) {
          flipped[o[i]] = i;
        }
      }
      return flipped;
    }

    // Return a valid alpha value [0,1] with all invalid values being set to 1
    function boundAlpha(a) {
      a = parseFloat(a);
      if (isNaN(a) || a < 0 || a > 1) {
        a = 1;
      }
      return a;
    }

    // Take input from [0, n] and return it as [0, 1]
    function bound01(n, max) {
      if (isOnePointZero(n)) n = "100%";
      var processPercent = isPercentage(n);
      n = Math.min(max, Math.max(0, parseFloat(n)));

      // Automatically convert percentage into number
      if (processPercent) {
        n = parseInt(n * max, 10) / 100;
      }

      // Handle floating point rounding errors
      if (Math.abs(n - max) < 0.000001) {
        return 1;
      }

      // Convert into [0, 1] range if it isn't already
      return n % max / parseFloat(max);
    }

    // Force a number between 0 and 1
    function clamp01(val) {
      return Math.min(1, Math.max(0, val));
    }

    // Parse a base-16 hex value into a base-10 integer
    function parseIntFromHex(val) {
      return parseInt(val, 16);
    }

    // Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
    // <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
    function isOnePointZero(n) {
      return typeof n == "string" && n.indexOf(".") != -1 && parseFloat(n) === 1;
    }

    // Check to see if string passed in is a percentage
    function isPercentage(n) {
      return typeof n === "string" && n.indexOf("%") != -1;
    }

    // Force a hex value to have 2 characters
    function pad2(c) {
      return c.length == 1 ? "0" + c : "" + c;
    }

    // Replace a decimal with it's percentage value
    function convertToPercentage(n) {
      if (n <= 1) {
        n = n * 100 + "%";
      }
      return n;
    }

    // Converts a decimal to a hex value
    function convertDecimalToHex(d) {
      return Math.round(parseFloat(d) * 255).toString(16);
    }
    // Converts a hex value to a decimal
    function convertHexToDecimal(h) {
      return parseIntFromHex(h) / 255;
    }
    var matchers = function () {
      // <http://www.w3.org/TR/css3-values/#integers>
      var CSS_INTEGER = "[-\\+]?\\d+%?";

      // <http://www.w3.org/TR/css3-values/#number-value>
      var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

      // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
      var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

      // Actual matching.
      // Parentheses and commas are optional, but not required.
      // Whitespace can take the place of commas or opening paren
      var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
      var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
      return {
        CSS_UNIT: new RegExp(CSS_UNIT),
        rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
        rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
        hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
        hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
        hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
        hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
        hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
        hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
        hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
        hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
      };
    }();

    // `isValidCSSUnit`
    // Take in a single string / number and check to see if it looks like a CSS unit
    // (see `matchers` above for definition).
    function isValidCSSUnit(color) {
      return !!matchers.CSS_UNIT.exec(color);
    }

    // `stringInputToObject`
    // Permissive string parsing.  Take in a number of formats, and output an object
    // based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
    function stringInputToObject(color) {
      color = color.replace(trimLeft, "").replace(trimRight, "").toLowerCase();
      var named = false;
      if (names[color]) {
        color = names[color];
        named = true;
      } else if (color == "transparent") {
        return {
          r: 0,
          g: 0,
          b: 0,
          a: 0,
          format: "name"
        };
      }

      // Try to match string input using regular expressions.
      // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
      // Just return an object and let the conversion functions handle that.
      // This way the result will be the same whether the tinycolor is initialized with string or object.
      var match;
      if (match = matchers.rgb.exec(color)) {
        return {
          r: match[1],
          g: match[2],
          b: match[3]
        };
      }
      if (match = matchers.rgba.exec(color)) {
        return {
          r: match[1],
          g: match[2],
          b: match[3],
          a: match[4]
        };
      }
      if (match = matchers.hsl.exec(color)) {
        return {
          h: match[1],
          s: match[2],
          l: match[3]
        };
      }
      if (match = matchers.hsla.exec(color)) {
        return {
          h: match[1],
          s: match[2],
          l: match[3],
          a: match[4]
        };
      }
      if (match = matchers.hsv.exec(color)) {
        return {
          h: match[1],
          s: match[2],
          v: match[3]
        };
      }
      if (match = matchers.hsva.exec(color)) {
        return {
          h: match[1],
          s: match[2],
          v: match[3],
          a: match[4]
        };
      }
      if (match = matchers.hex8.exec(color)) {
        return {
          r: parseIntFromHex(match[1]),
          g: parseIntFromHex(match[2]),
          b: parseIntFromHex(match[3]),
          a: convertHexToDecimal(match[4]),
          format: named ? "name" : "hex8"
        };
      }
      if (match = matchers.hex6.exec(color)) {
        return {
          r: parseIntFromHex(match[1]),
          g: parseIntFromHex(match[2]),
          b: parseIntFromHex(match[3]),
          format: named ? "name" : "hex"
        };
      }
      if (match = matchers.hex4.exec(color)) {
        return {
          r: parseIntFromHex(match[1] + "" + match[1]),
          g: parseIntFromHex(match[2] + "" + match[2]),
          b: parseIntFromHex(match[3] + "" + match[3]),
          a: convertHexToDecimal(match[4] + "" + match[4]),
          format: named ? "name" : "hex8"
        };
      }
      if (match = matchers.hex3.exec(color)) {
        return {
          r: parseIntFromHex(match[1] + "" + match[1]),
          g: parseIntFromHex(match[2] + "" + match[2]),
          b: parseIntFromHex(match[3] + "" + match[3]),
          format: named ? "name" : "hex"
        };
      }
      return false;
    }
    function validateWCAG2Parms(parms) {
      // return valid WCAG2 parms for isReadable.
      // If input parms are invalid, return {"level":"AA", "size":"small"}
      var level, size;
      parms = parms || {
        level: "AA",
        size: "small"
      };
      level = (parms.level || "AA").toUpperCase();
      size = (parms.size || "small").toLowerCase();
      if (level !== "AA" && level !== "AAA") {
        level = "AA";
      }
      if (size !== "small" && size !== "large") {
        size = "small";
      }
      return {
        level: level,
        size: size
      };
    }

    /**
     * Dimension parsing regexp.
     *
     * https://www.w3.org/TR/css3-values/#numbers
     * "a number is either an integer, or zero or more decimal digits
     * followed by a dot (.) followed by one or more decimal digits and
     * optionally an exponent composed of "e" or "E" and an integer."
     *
     * Don't forget the signs though...
     * => ([+-]?(?:\d+|\d*\.\d+(?:[eE][+-]?\d+)?))
     *
     * To get the unit, itself, just allow any alphabetic sequence and the '%' char.
     * => ([a-z]*|%)
     */
    const DIMENSION_REGEX = /^([+-]?(?:\d+|\d*\.\d+(?:[eE][+-]?\d+)?))([a-z]*|%)$/;
    /**
     * Commonly used dpi for unit conversion.
     */
    const DPI = 96;
    /**
     * Conversion factors for absolute units.
     * https://developer.mozilla.org/en-US/docs/web/css/length
     */
    const ABSOLUTE_UNITS = {
        in: DPI,
        cm: DPI / 2.54,
        mm: DPI / 25.4,
        pt: DPI / 72,
        pc: DPI / 6,
        px: 1
    };
    // pre-calculated factor for % conversion
    const SQRT2 = Math.sqrt(2);
    /**
     * Converts the given string to px unit. May be either a
     * [length](https://developer.mozilla.org/de/docs/Web/SVG/Content_type#Length)
     * or a [percentage](https://developer.mozilla.org/de/docs/Web/SVG/Content_type#Percentage).
     * @returns The value in px unit
     */
    function convertToPixelUnit(context, element, dimensionValue, attribute) {
        const { value, unit } = parseDimension(dimensionValue);
        if (isAbsoluteUnit(unit)) {
            return absToPixel(value, unit);
        }
        return relToPixel(context, element, attribute, value, unit);
    }
    /**
     * Parses the given string and returns a dimension, which is a
     * [number](https://www.w3.org/TR/css3-values/#numbers) followed
     * by a unit identifier.
     */
    function parseDimension(dimension) {
        const match = dimension.match(DIMENSION_REGEX);
        if (match === null || match.length !== 3) {
            throw new Error(`Cannot parse dimension: ${dimension}`);
        }
        return { value: parseFloat(match[1]), unit: match[2].toLowerCase() || 'px' };
    }
    /**
     * unit-css converts per HTML spec, which is differently for percentages in SVG
     * https://www.w3.org/TR/SVG/coords.html#Units
     * https://oreillymedia.github.io/Using_SVG/guide/units.html
     * @param percentage [0, 100]
     * @param viewBox The coordinate system to evaluate the percentage against
     */
    function percentageToPixel(attribute, percentage, { w: width, h: height } = { w: 0, h: 0 }) {
        const fraction = percentage / 100;
        // x and y are relative to the coordinate system's width or height
        if (attribute === 'x') {
            return fraction * width;
        }
        if (attribute === 'y') {
            return fraction * height;
        }
        return fraction * (Math.sqrt(width * width + height * height) / SQRT2);
    }
    /**
     * Converts an absolute unit to pixels.
     */
    function absToPixel(value, unit) {
        var _a;
        const conversion = (_a = ABSOLUTE_UNITS[unit]) !== null && _a !== void 0 ? _a : 1;
        return value * conversion;
    }
    /**
     * Converts a relative unit to pixels.
     */
    function relToPixel(context, element, attribute, value, unit) {
        var _a;
        const coordinateSystemSize = (_a = context.viewBox) !== null && _a !== void 0 ? _a : { w: 0, h: 0 };
        if (unit === '%') {
            return percentageToPixel(attribute, value, coordinateSystemSize);
        }
        if (unit === 'vw' || unit === 'vh' || unit === 'vmin' || unit === 'vmax') {
            return viewportLengthToPixel(value, unit, coordinateSystemSize);
        }
        if (unit === 'em' || unit === 'ex' || unit === 'ch' || unit === 'rem') {
            return fontRelativeToPixel(context, element, value, unit);
        }
        throw new Error(`Unsupported relative length unit: ${unit}`);
    }
    /**
     * https://oreillymedia.github.io/Using_SVG/guide/units.html#units-viewport-reference
     */
    function viewportLengthToPixel(value, unit, { w: width, h: height } = { w: 0, h: 0 }) {
        var _a, _b;
        const fraction = value / 100;
        const refWidth = (_a = window.innerWidth) !== null && _a !== void 0 ? _a : width;
        const refHeight = (_b = window.innerHeight) !== null && _b !== void 0 ? _b : height;
        if (unit === 'vw') {
            return fraction * refWidth;
        }
        if (unit === 'vh') {
            return fraction * refHeight;
        }
        if (unit === 'vmin') {
            return fraction * Math.min(refWidth, refHeight);
        }
        if (unit === 'vmax') {
            return fraction * Math.max(refWidth, refHeight);
        }
        throw new Error(`Not a viewport length unit: ${unit}`);
    }
    /**
     * https://oreillymedia.github.io/Using_SVG/guide/units.html#units-relative-reference
     */
    function fontRelativeToPixel(context, element, value, unit) {
        var _a;
        if (unit === 'rem') {
            const rootElement = document.documentElement;
            const fontSizeDimension = parseDimension(getComputedStyle(rootElement).fontSize);
            const fontSizePx = fontSizeDimension.unit === 'px' ? fontSizeDimension.value : 16;
            return value * fontSizePx;
        }
        if (unit === 'ch') {
            const zeroCharWidth = measureZeroCharacter(element);
            return value * zeroCharWidth;
        }
        // this should return a px font-size due to the getComputedStyle, otherwise use 16px as default fallback
        const effectiveFontSize = (_a = getEffectiveAttribute(context, element, 'font-size', context.useElementContext)) !== null && _a !== void 0 ? _a : '16px';
        const fontSizeDimension = parseDimension(effectiveFontSize);
        const fontSizePx = fontSizeDimension.unit === 'px' ? fontSizeDimension.value : 16;
        if (unit === 'em') {
            return value * fontSizePx;
        }
        if (unit === 'ex') {
            return value * fontSizePx * 0.5;
        }
        throw new Error(`Not a font relative unit: ${unit}`);
    }
    /**
     * Whether the given unit is an absolute unit.
     */
    function isAbsoluteUnit(unit) {
        return !!ABSOLUTE_UNITS[unit];
    }
    /**
     * Returns the width of the '0' character in the context of the element.
     */
    function measureZeroCharacter(element) {
        const parent = getParentElement(element);
        if (!parent) {
            return 1;
        }
        const measureContainer = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        measureContainer.style.visibility = 'hidden';
        measureContainer.appendChild(document.createTextNode('0'));
        parent.appendChild(measureContainer);
        const bbox = measureContainer.getBBox();
        parent.removeChild(measureContainer);
        return bbox.width;
    }

    /**
     * Whether the given SVGTransform resembles an identity transform.
     * @returns Whether the transform is an identity transform.
     *  Returns true if transform is undefined.
     */
    function isIdentityTransform(svgTransform) {
        if (!svgTransform) {
            return true;
        }
        const matrix = svgTransform.matrix;
        return (!matrix ||
            (matrix.a === 1 &&
                matrix.b === 0 &&
                matrix.c === 0 &&
                matrix.d === 1 &&
                matrix.e === 0 &&
                matrix.f === 0));
    }
    /**
     * Whether the given SVGTransform does not scale nor skew.
     * @returns Whether the given SVGTransform does not scale nor skew.
     *  Returns true if transform is undefined.
     */
    function isTranslationTransform(svgTransform) {
        if (!svgTransform) {
            return true;
        }
        const matrix = svgTransform.matrix;
        return !matrix || (matrix.a === 1 && matrix.b === 0 && matrix.c === 0 && matrix.d === 1);
    }
    /**
     * Applies a given `SVGTransform` to the point.
     *
     * [a c e] [x] = (a*x + c*y + e)
     * [b d f] [y] = (b*x + d*y + f)
     * [0 0 1] [1] = (0 + 0 + 1)
     */
    function applyMatrix(point, svgTransform) {
        if (!svgTransform) {
            return point;
        }
        const matrix = svgTransform.matrix;
        const x = matrix.a * point.x + matrix.c * point.y + matrix.e;
        const y = matrix.b * point.x + matrix.d * point.y + matrix.f;
        return { x, y };
    }
    /**
     * Returns the consolidated transform of the given element.
     */
    function getSvgTransform(element) {
        if (element.transform && element.transform.baseVal.numberOfItems > 0) {
            return element.transform.baseVal.consolidate();
        }
        return null;
    }
    /**
     * Combines the given transform with the element's transform.
     * If no transform is given, it returns the SVGTransform of the element.
     */
    function getCombinedTransform(context, element, transform) {
        if (!transform) {
            return getSvgTransform(element);
        }
        const elementTransform = getSvgTransform(element);
        if (elementTransform) {
            const elementTransformMatrix = elementTransform.matrix;
            const combinedMatrix = transform.matrix.multiply(elementTransformMatrix);
            return context.sourceSvg.createSVGTransformFromMatrix(combinedMatrix);
        }
        return transform;
    }
    /**
     * Applies the given svgTransform to the given element.
     * @param element The element to which the transform should be applied.
     */
    function applyTransform(context, svgTransform, element) {
        if (svgTransform && svgTransform.matrix && !isIdentityTransform(svgTransform)) {
            const matrix = svgTransform.matrix;
            if (element.transform.baseVal.numberOfItems > 0) {
                element.transform.baseVal.getItem(0).setMatrix(matrix);
            }
            else {
                element.transform.baseVal.appendItem(svgTransform);
            }
        }
    }

    /**
     * Converts an SVG gradient to a color by mixing all stop colors
     * with `tinycolor.mix`.
     */
    function gradientToColor(gradient, opacity) {
        const stops = Array.prototype.slice.apply(gradient.querySelectorAll('stop'));
        if (stops.length === 0) {
            return 'transparent';
        }
        else if (stops.length === 1) {
            const color = getStopColor(stops[0]);
            color.setAlpha(opacity);
            return color.toString();
        }
        else {
            // Because roughjs can only deal with solid colors, we try to calculate
            // the average color of the gradient here.
            // The idea is to create an array of discrete (average) colors that represents the
            // gradient under consideration of the stop's offset. Thus, larger offsets
            // result in more entries of the same mixed color (of the two adjacent color stops).
            // At the end, this array is averaged again, to create a single solid color.
            const resolution = 10;
            const discreteColors = [];
            let lastColor = null;
            for (let i = 0; i < stops.length; i++) {
                const currentColor = getStopColor(stops[i]);
                const currentOffset = getStopOffset(stops[i]);
                // combine the adjacent colors
                const combinedColor = lastColor ? averageColor([lastColor, currentColor]) : currentColor;
                // fill the discrete color array depending on the offset size
                let entries = Math.max(1, (currentOffset / resolution) | 0);
                while (entries > 0) {
                    discreteColors.push(combinedColor);
                    entries--;
                }
                lastColor = currentColor;
            }
            // average the discrete colors again for the final result
            const mixedColor = averageColor(discreteColors);
            mixedColor.setAlpha(opacity);
            return mixedColor.toString();
        }
    }
    /**
     * Returns the `stop-color` of an `SVGStopElement`.
     */
    function getStopColor(stop) {
        var _a;
        let stopColorStr = stop.getAttribute('stop-color');
        if (!stopColorStr) {
            const style = (_a = stop.getAttribute('style')) !== null && _a !== void 0 ? _a : '';
            const match = /stop-color:\s?(.*);?/.exec(style);
            if (match && match.length > 1) {
                stopColorStr = match[1];
            }
        }
        return stopColorStr ? tinycolor(stopColorStr) : tinycolor('white');
    }
    /**
     * Calculates the average color of the colors in the given array.
     * @returns The average color
     */
    function averageColor(colorArray) {
        const count = colorArray.length;
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        colorArray.forEach(tinycolor => {
            const color = tinycolor.toRgb();
            r += color.r * color.r;
            g += color.g * color.g;
            b += color.b * color.b;
            a += color.a;
        });
        return tinycolor({
            r: Math.sqrt(r / count),
            g: Math.sqrt(g / count),
            b: Math.sqrt(b / count),
            a: a / count
        });
    }
    /**
     * Returns the `offset` of an `SVGStopElement`.
     * @return stop percentage
     */
    function getStopOffset(stop) {
        const offset = stop.getAttribute('offset');
        if (!offset) {
            return 0;
        }
        if (offset.indexOf('%')) {
            return parseFloat(offset.substring(0, offset.length - 1));
        }
        else {
            return parseFloat(offset) * 100;
        }
    }

    function getPenConfiguration(fillStyle) {
        // the svg2roughjs v2 config
        const legacyConfig = {
            angle: {
                normal: [-30, -50],
                horizontal: [-30, -50],
                vertical: [-30, -50]
            },
            weight: {
                normal: [0.5, 3],
                small: [0.5, 3]
            },
            gap: {
                normal: [3, 5],
                small: [3, 5]
            }
        };
        // adjusted config for more variation
        const defaultConfig = {
            angle: {
                // just lean more into the direction of the aspect ratio
                normal: [-30, -50],
                horizontal: [-50, -75],
                vertical: [-30, -15]
            },
            weight: {
                normal: [1, 3],
                small: [0.5, 1.7]
            },
            gap: {
                normal: [2, 5],
                small: [1, 3]
            }
        };
        // fine-tune configs depending on fill-style
        switch (fillStyle) {
            default:
                return defaultConfig;
            case 'zigzag':
            case 'zigzag-line':
                return Object.assign(Object.assign({}, defaultConfig), { weight: { normal: [0.5, 3], small: [0.5, 2] }, gap: { normal: [2, 6], small: [2, 5] } });
            case 'cross-hatch':
                return Object.assign(Object.assign({}, defaultConfig), { weight: { normal: [1, 3], small: [0.5, 1.3] }, gap: { normal: [4, 8], small: [2, 5] } });
            case 'dots':
                return legacyConfig;
        }
    }
    /**
     * Creates a random rendering configuration for the given element.
     * The returned pen is specific of the `config.fillStyle` and the element's shape.
     */
    function createPen(context, element) {
        if (context.roughConfig.fillStyle === 'solid') {
            // config doesn't affect drawing
            return { angle: 0, gap: 0, weight: 0 };
        }
        // Only works when the element is in the DOM, but no need to check it here,
        // since the related methods can cope with non-finite or zero cases.
        const { width, height } = element.getBoundingClientRect();
        const aspectRatio = width / height;
        const sideLength = Math.sqrt(width * height);
        const { angle, gap, weight } = getPenConfiguration(context.roughConfig.fillStyle);
        return {
            angle: getHachureAngle(context, angle, aspectRatio),
            gap: getHachureGap(context, gap, sideLength),
            weight: getFillWeight(context, weight, sideLength)
        };
    }
    /**
     * Returns a random hachure angle in the range of the given config.
     *
     * Rough.js default is -41deg
     */
    function getHachureAngle({ rng }, { normal, horizontal, vertical }, aspectRatio) {
        if (isFinite(aspectRatio)) {
            // sketch elements along the smaller side
            if (aspectRatio < 0.25) {
                return rng.next(horizontal);
            }
            else if (aspectRatio > 6) {
                return rng.next(vertical);
            }
        }
        return rng.next(normal);
    }
    /**
     * Returns a random hachure gap in the range of the given config.
     *
     * Rough.js default is 4 * strokeWidth
     */
    function getHachureGap({ rng }, { normal, small }, sideLength) {
        return sideLength < 45 ? rng.next(small) : rng.next(normal);
    }
    /**
     * Returns a random fill weight in the range of the given config.
     *
     * Rough.js default is 0.5 * strokeWidth
     */
    function getFillWeight({ rng }, { normal, small }, sideLength) {
        return sideLength < 45 ? rng.next(small) : rng.next(normal);
    }

    /**
     * Converts the effective style attributes of the given `SVGElement`
     * to a Rough.js config object that is used to draw the element with
     * Rough.js.
     * @return config for Rough.js drawing
     */
    function parseStyleConfig(context, element, svgTransform) {
        var _a;
        const precision = (_a = context.roughConfig.fixedDecimalPlaceDigits) !== null && _a !== void 0 ? _a : 15;
        const config = Object.assign({}, context.roughConfig);
        // Scalefactor for certain style attributes. For lack of a better option here, use the determinant
        let scaleFactor = 1;
        if (!isIdentityTransform(svgTransform)) {
            const m = svgTransform.matrix;
            const det = m.a * m.d - m.c * m.b;
            scaleFactor = Math.sqrt(Math.abs(det));
        }
        // incorporate the elements base opacity
        const elementOpacity = getEffectiveElementOpacity(context, element, 1, context.useElementContext);
        const fill = getEffectiveAttribute(context, element, 'fill', context.useElementContext) || 'black';
        const fillOpacity = elementOpacity * getOpacity(element, 'fill-opacity');
        if (fill) {
            if (fill.indexOf('url') !== -1) {
                const gradientColor = convertGradient(context, fill, fillOpacity);
                if (gradientColor !== 'none') {
                    config.fill = gradientColor;
                }
                else {
                    // delete fill, otherwise it may create an invisible 'hachure' element
                    delete config.fill;
                }
            }
            else if (fill === 'none') {
                // delete fill, otherwise it may create an invisible 'hachure' element
                delete config.fill;
            }
            else {
                const color = tinycolor(fill);
                color.setAlpha(fillOpacity);
                config.fill = color.toString();
            }
        }
        const stroke = getEffectiveAttribute(context, element, 'stroke', context.useElementContext);
        const strokeOpacity = elementOpacity * getOpacity(element, 'stroke-opacity');
        if (stroke) {
            if (stroke.indexOf('url') !== -1) {
                config.stroke = convertGradient(context, stroke, strokeOpacity);
            }
            else if (stroke === 'none') {
                config.stroke = 'none';
            }
            else {
                const color = tinycolor(stroke);
                color.setAlpha(strokeOpacity);
                config.stroke = color.toString();
            }
        }
        else {
            config.stroke = 'none';
        }
        const strokeWidth = getEffectiveAttribute(context, element, 'stroke-width', context.useElementContext);
        if (strokeWidth) {
            // Convert to user space units (px)
            const scaledWidth = convertToPixelUnit(context, element, strokeWidth, 'stroke-width') * scaleFactor;
            config.strokeWidth = parseFloat(scaledWidth.toFixed(precision));
        }
        else {
            // default stroke-width is 1
            config.strokeWidth = 1;
        }
        const strokeDashArray = getEffectiveAttribute(context, element, 'stroke-dasharray', context.useElementContext);
        if (strokeDashArray && strokeDashArray !== 'none') {
            config.strokeLineDash = strokeDashArray
                .split(/[\s,]+/)
                .filter(entry => entry.length > 0)
                // make sure that dashes/dots are at least somewhat visible
                .map(dash => {
                const scaledLineDash = convertToPixelUnit(context, element, dash, 'stroke-dasharray') * scaleFactor;
                return Math.max(0.5, parseFloat(scaledLineDash.toFixed(precision)));
            });
        }
        const strokeDashOffset = getEffectiveAttribute(context, element, 'stroke-dashoffset', context.useElementContext);
        if (strokeDashOffset) {
            const scaledOffset = convertToPixelUnit(context, element, strokeDashOffset, 'stroke-dashoffset') * scaleFactor;
            config.strokeLineDashOffset = parseFloat(scaledOffset.toFixed(precision));
        }
        // unstroked but filled shapes look weird, so always apply a stroke if we fill something
        if (config.fill && config.stroke === 'none') {
            config.stroke = config.fill;
            config.strokeWidth = 1;
        }
        if (context.randomize) {
            const { angle, gap, weight } = createPen(context, element);
            config.hachureAngle = angle;
            config.hachureGap = Math.round(gap); // must be integer (avg gap in pixels)
            config.fillWeight = parseFloat(weight.toFixed(precision)); // value is used in the sketched output as-is
            // randomize double stroke effect if not explicitly set through user config
            if (typeof config.disableMultiStroke === 'undefined') {
                config.disableMultiStroke = context.rng.next() > 0.3;
            }
        }
        return config;
    }
    /**
     * Converts SVG opacity attributes to a [0, 1] range.
     */
    function getOpacity(element, attribute) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attr = getComputedStyle(element)[attribute] || element.getAttribute(attribute);
        if (attr) {
            if (attr.indexOf('%') !== -1) {
                return Math.min(1, Math.max(0, parseFloat(attr.substring(0, attr.length - 1)) / 100));
            }
            return Math.min(1, Math.max(0, parseFloat(attr)));
        }
        return 1;
    }
    /**
     * Parses a `fill` url by looking in the SVG `defs` element.
     * When a gradient is found, it is converted to a color and stored
     * in the internal defs store for this url.
     *
     * Patterns are ignored and returned with 'none'.
     *
     * @returns The parsed color
     */
    function convertGradient(context, url, opacity) {
        const id = getIdFromUrl(url);
        if (!id) {
            return 'none';
        }
        const paint = context.idElements[id];
        if (!paint) {
            return 'none';
        }
        if (typeof paint === 'string') {
            // maybe it was already parsed and replaced with a color
            return paint;
        }
        else if (paint instanceof SVGLinearGradientElement ||
            paint instanceof SVGRadialGradientElement) {
            const color = gradientToColor(paint, opacity);
            context.idElements[id] = color;
            return color;
        }
        else {
            // pattern or something else that cannot be directly used in the roughjs config
            return 'none';
        }
    }
    function isHidden(element) {
        const style = element.style;
        if (!style) {
            return false;
        }
        return style.display === 'none' || style.visibility === 'hidden';
    }
    function concatStyleStrings(...args) {
        let ret = '';
        args = args.filter(s => s !== null);
        for (const style of args) {
            if (ret.length > 0 && ret[ret.length - 1] !== ';') {
                ret += ';';
            }
            ret += style;
        }
        return ret;
    }

    function str(p) {
        return `${p.x},${p.y}`;
    }
    function equals(p0, p1) {
        return p0.x === p1.x && p0.y === p1.y;
    }

    function drawCircle(context, circle, svgTransform) {
        const cx = circle.cx.baseVal.value;
        const cy = circle.cy.baseVal.value;
        const r = circle.r.baseVal.value;
        if (r === 0) {
            // zero-radius circle is not rendered
            return;
        }
        const center = applyMatrix({ x: cx, y: cy }, svgTransform);
        const radiusPoint = applyMatrix({ x: cx + r, y: cy + r }, svgTransform);
        const transformedRadius = radiusPoint.x - center.x;
        let result;
        if (isIdentityTransform(svgTransform) || isTranslationTransform(svgTransform)) {
            // transform a point on the ellipse to get the transformed radius
            result = context.rc.circle(center.x, center.y, 2 * transformedRadius, Object.assign(Object.assign({}, parseStyleConfig(context, circle, svgTransform)), { preserveVertices: true }));
        }
        else {
            // in other cases we need to construct the path manually.
            const factor = (4 / 3) * (Math.sqrt(2) - 1);
            const p1 = applyMatrix({ x: cx + r, y: cy }, svgTransform);
            const p2 = applyMatrix({ x: cx, y: cy + r }, svgTransform);
            const p3 = applyMatrix({ x: cx - r, y: cy }, svgTransform);
            const p4 = applyMatrix({ x: cx, y: cy - r }, svgTransform);
            const c1 = applyMatrix({ x: cx + r, y: cy + factor * r }, svgTransform);
            const c2 = applyMatrix({ x: cx + factor * r, y: cy + r }, svgTransform);
            const c4 = applyMatrix({ x: cx - r, y: cy + factor * r }, svgTransform);
            const c6 = applyMatrix({ x: cx - factor * r, y: cy - r }, svgTransform);
            const c8 = applyMatrix({ x: cx + r, y: cy - factor * r }, svgTransform);
            const path = `M ${str(p1)} C ${str(c1)} ${str(c2)} ${str(p2)} S ${str(c4)} ${str(p3)} S ${str(c6)} ${str(p4)} S ${str(c8)} ${str(p1)}z`;
            result = sketchPath(context, path, parseStyleConfig(context, circle, svgTransform));
        }
        appendPatternPaint(context, circle, () => {
            const proxy = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            proxy.cx.baseVal.value = center.x;
            proxy.cy.baseVal.value = center.y;
            proxy.r.baseVal.value = transformedRadius;
            return proxy;
        });
        appendSketchElement(context, circle, result);
    }
    function applyCircleClip(context, circle, container, svgTransform) {
        const cx = circle.cx.baseVal.value;
        const cy = circle.cy.baseVal.value;
        const r = circle.r.baseVal.value;
        if (r === 0) {
            // zero-radius circle is not rendered
            return;
        }
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        clip.cx.baseVal.value = cx;
        clip.cy.baseVal.value = cy;
        clip.r.baseVal.value = r;
        applyTransform(context, svgTransform, clip);
        container.appendChild(clip);
    }

    function drawEllipse(context, ellipse, svgTransform) {
        const cx = ellipse.cx.baseVal.value;
        const cy = ellipse.cy.baseVal.value;
        const rx = ellipse.rx.baseVal.value;
        const ry = ellipse.ry.baseVal.value;
        if (rx === 0 || ry === 0) {
            // zero-radius ellipse is not rendered
            return;
        }
        const center = applyMatrix({ x: cx, y: cy }, svgTransform);
        // transform a point on the ellipse to get the transformed radius
        const radiusPoint = applyMatrix({ x: cx + rx, y: cy + ry }, svgTransform);
        const transformedRx = radiusPoint.x - center.x;
        const transformedRy = radiusPoint.y - center.y;
        let result;
        if (isIdentityTransform(svgTransform) || isTranslationTransform(svgTransform)) {
            // Simple case, there's no transform and we can use the ellipse command
            result = context.rc.ellipse(center.x, center.y, 2 * transformedRx, 2 * transformedRy, Object.assign(Object.assign({}, parseStyleConfig(context, ellipse, svgTransform)), { preserveVertices: true }));
        }
        else {
            // in other cases we need to construct the path manually.
            const factor = (4 / 3) * (Math.sqrt(2) - 1);
            const p1 = applyMatrix({ x: cx + rx, y: cy }, svgTransform);
            const p2 = applyMatrix({ x: cx, y: cy + ry }, svgTransform);
            const p3 = applyMatrix({ x: cx - rx, y: cy }, svgTransform);
            const p4 = applyMatrix({ x: cx, y: cy - ry }, svgTransform);
            const c1 = applyMatrix({ x: cx + rx, y: cy + factor * ry }, svgTransform);
            const c2 = applyMatrix({ x: cx + factor * rx, y: cy + ry }, svgTransform);
            const c4 = applyMatrix({ x: cx - rx, y: cy + factor * ry }, svgTransform);
            const c6 = applyMatrix({ x: cx - factor * rx, y: cy - ry }, svgTransform);
            const c8 = applyMatrix({ x: cx + rx, y: cy - factor * ry }, svgTransform);
            const path = `M ${str(p1)} C ${str(c1)} ${str(c2)} ${str(p2)} S ${str(c4)} ${str(p3)} S ${str(c6)} ${str(p4)} S ${str(c8)} ${str(p1)}z`;
            result = sketchPath(context, path, parseStyleConfig(context, ellipse, svgTransform));
        }
        appendPatternPaint(context, ellipse, () => {
            const proxy = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            proxy.cx.baseVal.value = center.x;
            proxy.cy.baseVal.value = center.y;
            proxy.rx.baseVal.value = transformedRx;
            proxy.ry.baseVal.value = transformedRy;
            return proxy;
        });
        appendSketchElement(context, ellipse, result);
    }
    function applyEllipseClip(context, ellipse, container, svgTransform) {
        const cx = ellipse.cx.baseVal.value;
        const cy = ellipse.cy.baseVal.value;
        const rx = ellipse.rx.baseVal.value;
        const ry = ellipse.ry.baseVal.value;
        if (rx === 0 || ry === 0) {
            // zero-radius ellipse is not rendered
            return;
        }
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        clip.cx.baseVal.value = cx;
        clip.cy.baseVal.value = cy;
        clip.rx.baseVal.value = rx;
        clip.ry.baseVal.value = ry;
        applyTransform(context, svgTransform, clip);
        container.appendChild(clip);
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    var t=function(r,e){return (t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,r){t.__proto__=r;}||function(t,r){for(var e in r)Object.prototype.hasOwnProperty.call(r,e)&&(t[e]=r[e]);})(r,e)};function r(r,e){if("function"!=typeof e&&null!==e)throw new TypeError("Class extends value "+String(e)+" is not a constructor or null");function i(){this.constructor=r;}t(r,e),r.prototype=null===e?Object.create(e):(i.prototype=e.prototype,new i);}function e(t){var r="";Array.isArray(t)||(t=[t]);for(var e=0;e<t.length;e++){var i=t[e];if(i.type===_.CLOSE_PATH)r+="z";else if(i.type===_.HORIZ_LINE_TO)r+=(i.relative?"h":"H")+i.x;else if(i.type===_.VERT_LINE_TO)r+=(i.relative?"v":"V")+i.y;else if(i.type===_.MOVE_TO)r+=(i.relative?"m":"M")+i.x+" "+i.y;else if(i.type===_.LINE_TO)r+=(i.relative?"l":"L")+i.x+" "+i.y;else if(i.type===_.CURVE_TO)r+=(i.relative?"c":"C")+i.x1+" "+i.y1+" "+i.x2+" "+i.y2+" "+i.x+" "+i.y;else if(i.type===_.SMOOTH_CURVE_TO)r+=(i.relative?"s":"S")+i.x2+" "+i.y2+" "+i.x+" "+i.y;else if(i.type===_.QUAD_TO)r+=(i.relative?"q":"Q")+i.x1+" "+i.y1+" "+i.x+" "+i.y;else if(i.type===_.SMOOTH_QUAD_TO)r+=(i.relative?"t":"T")+i.x+" "+i.y;else {if(i.type!==_.ARC)throw new Error('Unexpected command type "'+i.type+'" at index '+e+".");r+=(i.relative?"a":"A")+i.rX+" "+i.rY+" "+i.xRot+" "+ +i.lArcFlag+" "+ +i.sweepFlag+" "+i.x+" "+i.y;}}return r}function i(t,r){var e=t[0],i=t[1];return [e*Math.cos(r)-i*Math.sin(r),e*Math.sin(r)+i*Math.cos(r)]}function a(){for(var t=[],r=0;r<arguments.length;r++)t[r]=arguments[r];for(var e=0;e<t.length;e++)if("number"!=typeof t[e])throw new Error("assertNumbers arguments["+e+"] is not a number. "+typeof t[e]+" == typeof "+t[e]);return !0}var n=Math.PI;function o(t,r,e){t.lArcFlag=0===t.lArcFlag?0:1,t.sweepFlag=0===t.sweepFlag?0:1;var a=t.rX,o=t.rY,s=t.x,u=t.y;a=Math.abs(t.rX),o=Math.abs(t.rY);var h=i([(r-s)/2,(e-u)/2],-t.xRot/180*n),c=h[0],y=h[1],p=Math.pow(c,2)/Math.pow(a,2)+Math.pow(y,2)/Math.pow(o,2);1<p&&(a*=Math.sqrt(p),o*=Math.sqrt(p)),t.rX=a,t.rY=o;var m=Math.pow(a,2)*Math.pow(y,2)+Math.pow(o,2)*Math.pow(c,2),O=(t.lArcFlag!==t.sweepFlag?1:-1)*Math.sqrt(Math.max(0,(Math.pow(a,2)*Math.pow(o,2)-m)/m)),l=a*y/o*O,T=-o*c/a*O,v=i([l,T],t.xRot/180*n);t.cX=v[0]+(r+s)/2,t.cY=v[1]+(e+u)/2,t.phi1=Math.atan2((y-T)/o,(c-l)/a),t.phi2=Math.atan2((-y-T)/o,(-c-l)/a),0===t.sweepFlag&&t.phi2>t.phi1&&(t.phi2-=2*n),1===t.sweepFlag&&t.phi2<t.phi1&&(t.phi2+=2*n),t.phi1*=180/n,t.phi2*=180/n;}function s(t,r,e){a(t,r,e);var i=t*t+r*r-e*e;if(0>i)return [];if(0===i)return [[t*e/(t*t+r*r),r*e/(t*t+r*r)]];var n=Math.sqrt(i);return [[(t*e+r*n)/(t*t+r*r),(r*e-t*n)/(t*t+r*r)],[(t*e-r*n)/(t*t+r*r),(r*e+t*n)/(t*t+r*r)]]}var u,h=Math.PI/180;function c(t,r,e){return (1-e)*t+e*r}function y(t,r,e,i){return t+Math.cos(i/180*n)*r+Math.sin(i/180*n)*e}function p(t,r,e,i){var a=1e-6,n=r-t,o=e-r,s=3*n+3*(i-e)-6*o,u=6*(o-n),h=3*n;return Math.abs(s)<a?[-h/u]:function(t,r,e){var i=t*t/4-r;if(i<-e)return [];if(i<=e)return [-t/2];var a=Math.sqrt(i);return [-t/2-a,-t/2+a]}(u/s,h/s,a)}function m(t,r,e,i,a){var n=1-a;return t*(n*n*n)+r*(3*n*n*a)+e*(3*n*a*a)+i*(a*a*a)}!function(t){function r(){return u((function(t,r,e){return t.relative&&(void 0!==t.x1&&(t.x1+=r),void 0!==t.y1&&(t.y1+=e),void 0!==t.x2&&(t.x2+=r),void 0!==t.y2&&(t.y2+=e),void 0!==t.x&&(t.x+=r),void 0!==t.y&&(t.y+=e),t.relative=!1),t}))}function e(){var t=NaN,r=NaN,e=NaN,i=NaN;return u((function(a,n,o){return a.type&_.SMOOTH_CURVE_TO&&(a.type=_.CURVE_TO,t=isNaN(t)?n:t,r=isNaN(r)?o:r,a.x1=a.relative?n-t:2*n-t,a.y1=a.relative?o-r:2*o-r),a.type&_.CURVE_TO?(t=a.relative?n+a.x2:a.x2,r=a.relative?o+a.y2:a.y2):(t=NaN,r=NaN),a.type&_.SMOOTH_QUAD_TO&&(a.type=_.QUAD_TO,e=isNaN(e)?n:e,i=isNaN(i)?o:i,a.x1=a.relative?n-e:2*n-e,a.y1=a.relative?o-i:2*o-i),a.type&_.QUAD_TO?(e=a.relative?n+a.x1:a.x1,i=a.relative?o+a.y1:a.y1):(e=NaN,i=NaN),a}))}function n(){var t=NaN,r=NaN;return u((function(e,i,a){if(e.type&_.SMOOTH_QUAD_TO&&(e.type=_.QUAD_TO,t=isNaN(t)?i:t,r=isNaN(r)?a:r,e.x1=e.relative?i-t:2*i-t,e.y1=e.relative?a-r:2*a-r),e.type&_.QUAD_TO){t=e.relative?i+e.x1:e.x1,r=e.relative?a+e.y1:e.y1;var n=e.x1,o=e.y1;e.type=_.CURVE_TO,e.x1=((e.relative?0:i)+2*n)/3,e.y1=((e.relative?0:a)+2*o)/3,e.x2=(e.x+2*n)/3,e.y2=(e.y+2*o)/3;}else t=NaN,r=NaN;return e}))}function u(t){var r=0,e=0,i=NaN,a=NaN;return function(n){if(isNaN(i)&&!(n.type&_.MOVE_TO))throw new Error("path must start with moveto");var o=t(n,r,e,i,a);return n.type&_.CLOSE_PATH&&(r=i,e=a),void 0!==n.x&&(r=n.relative?r+n.x:n.x),void 0!==n.y&&(e=n.relative?e+n.y:n.y),n.type&_.MOVE_TO&&(i=r,a=e),o}}function O(t,r,e,i,n,o){return a(t,r,e,i,n,o),u((function(a,s,u,h){var c=a.x1,y=a.x2,p=a.relative&&!isNaN(h),m=void 0!==a.x?a.x:p?0:s,O=void 0!==a.y?a.y:p?0:u;function l(t){return t*t}a.type&_.HORIZ_LINE_TO&&0!==r&&(a.type=_.LINE_TO,a.y=a.relative?0:u),a.type&_.VERT_LINE_TO&&0!==e&&(a.type=_.LINE_TO,a.x=a.relative?0:s),void 0!==a.x&&(a.x=a.x*t+O*e+(p?0:n)),void 0!==a.y&&(a.y=m*r+a.y*i+(p?0:o)),void 0!==a.x1&&(a.x1=a.x1*t+a.y1*e+(p?0:n)),void 0!==a.y1&&(a.y1=c*r+a.y1*i+(p?0:o)),void 0!==a.x2&&(a.x2=a.x2*t+a.y2*e+(p?0:n)),void 0!==a.y2&&(a.y2=y*r+a.y2*i+(p?0:o));var T=t*i-r*e;if(void 0!==a.xRot&&(1!==t||0!==r||0!==e||1!==i))if(0===T)delete a.rX,delete a.rY,delete a.xRot,delete a.lArcFlag,delete a.sweepFlag,a.type=_.LINE_TO;else {var v=a.xRot*Math.PI/180,f=Math.sin(v),N=Math.cos(v),x=1/l(a.rX),d=1/l(a.rY),E=l(N)*x+l(f)*d,A=2*f*N*(x-d),C=l(f)*x+l(N)*d,M=E*i*i-A*r*i+C*r*r,R=A*(t*i+r*e)-2*(E*e*i+C*t*r),g=E*e*e-A*t*e+C*t*t,I=(Math.atan2(R,M-g)+Math.PI)%Math.PI/2,S=Math.sin(I),L=Math.cos(I);a.rX=Math.abs(T)/Math.sqrt(M*l(L)+R*S*L+g*l(S)),a.rY=Math.abs(T)/Math.sqrt(M*l(S)-R*S*L+g*l(L)),a.xRot=180*I/Math.PI;}return void 0!==a.sweepFlag&&0>T&&(a.sweepFlag=+!a.sweepFlag),a}))}function l(){return function(t){var r={};for(var e in t)r[e]=t[e];return r}}t.ROUND=function(t){function r(r){return Math.round(r*t)/t}return void 0===t&&(t=1e13),a(t),function(t){return void 0!==t.x1&&(t.x1=r(t.x1)),void 0!==t.y1&&(t.y1=r(t.y1)),void 0!==t.x2&&(t.x2=r(t.x2)),void 0!==t.y2&&(t.y2=r(t.y2)),void 0!==t.x&&(t.x=r(t.x)),void 0!==t.y&&(t.y=r(t.y)),void 0!==t.rX&&(t.rX=r(t.rX)),void 0!==t.rY&&(t.rY=r(t.rY)),t}},t.TO_ABS=r,t.TO_REL=function(){return u((function(t,r,e){return t.relative||(void 0!==t.x1&&(t.x1-=r),void 0!==t.y1&&(t.y1-=e),void 0!==t.x2&&(t.x2-=r),void 0!==t.y2&&(t.y2-=e),void 0!==t.x&&(t.x-=r),void 0!==t.y&&(t.y-=e),t.relative=!0),t}))},t.NORMALIZE_HVZ=function(t,r,e){return void 0===t&&(t=!0),void 0===r&&(r=!0),void 0===e&&(e=!0),u((function(i,a,n,o,s){if(isNaN(o)&&!(i.type&_.MOVE_TO))throw new Error("path must start with moveto");return r&&i.type&_.HORIZ_LINE_TO&&(i.type=_.LINE_TO,i.y=i.relative?0:n),e&&i.type&_.VERT_LINE_TO&&(i.type=_.LINE_TO,i.x=i.relative?0:a),t&&i.type&_.CLOSE_PATH&&(i.type=_.LINE_TO,i.x=i.relative?o-a:o,i.y=i.relative?s-n:s),i.type&_.ARC&&(0===i.rX||0===i.rY)&&(i.type=_.LINE_TO,delete i.rX,delete i.rY,delete i.xRot,delete i.lArcFlag,delete i.sweepFlag),i}))},t.NORMALIZE_ST=e,t.QT_TO_C=n,t.INFO=u,t.SANITIZE=function(t){void 0===t&&(t=0),a(t);var r=NaN,e=NaN,i=NaN,n=NaN;return u((function(a,o,s,u,h){var c=Math.abs,y=!1,p=0,m=0;if(a.type&_.SMOOTH_CURVE_TO&&(p=isNaN(r)?0:o-r,m=isNaN(e)?0:s-e),a.type&(_.CURVE_TO|_.SMOOTH_CURVE_TO)?(r=a.relative?o+a.x2:a.x2,e=a.relative?s+a.y2:a.y2):(r=NaN,e=NaN),a.type&_.SMOOTH_QUAD_TO?(i=isNaN(i)?o:2*o-i,n=isNaN(n)?s:2*s-n):a.type&_.QUAD_TO?(i=a.relative?o+a.x1:a.x1,n=a.relative?s+a.y1:a.y2):(i=NaN,n=NaN),a.type&_.LINE_COMMANDS||a.type&_.ARC&&(0===a.rX||0===a.rY||!a.lArcFlag)||a.type&_.CURVE_TO||a.type&_.SMOOTH_CURVE_TO||a.type&_.QUAD_TO||a.type&_.SMOOTH_QUAD_TO){var O=void 0===a.x?0:a.relative?a.x:a.x-o,l=void 0===a.y?0:a.relative?a.y:a.y-s;p=isNaN(i)?void 0===a.x1?p:a.relative?a.x:a.x1-o:i-o,m=isNaN(n)?void 0===a.y1?m:a.relative?a.y:a.y1-s:n-s;var T=void 0===a.x2?0:a.relative?a.x:a.x2-o,v=void 0===a.y2?0:a.relative?a.y:a.y2-s;c(O)<=t&&c(l)<=t&&c(p)<=t&&c(m)<=t&&c(T)<=t&&c(v)<=t&&(y=!0);}return a.type&_.CLOSE_PATH&&c(o-u)<=t&&c(s-h)<=t&&(y=!0),y?[]:a}))},t.MATRIX=O,t.ROTATE=function(t,r,e){void 0===r&&(r=0),void 0===e&&(e=0),a(t,r,e);var i=Math.sin(t),n=Math.cos(t);return O(n,i,-i,n,r-r*n+e*i,e-r*i-e*n)},t.TRANSLATE=function(t,r){return void 0===r&&(r=0),a(t,r),O(1,0,0,1,t,r)},t.SCALE=function(t,r){return void 0===r&&(r=t),a(t,r),O(t,0,0,r,0,0)},t.SKEW_X=function(t){return a(t),O(1,0,Math.atan(t),1,0,0)},t.SKEW_Y=function(t){return a(t),O(1,Math.atan(t),0,1,0,0)},t.X_AXIS_SYMMETRY=function(t){return void 0===t&&(t=0),a(t),O(-1,0,0,1,t,0)},t.Y_AXIS_SYMMETRY=function(t){return void 0===t&&(t=0),a(t),O(1,0,0,-1,0,t)},t.A_TO_C=function(){return u((function(t,r,e){return _.ARC===t.type?function(t,r,e){var a,n,s,u;t.cX||o(t,r,e);for(var y=Math.min(t.phi1,t.phi2),p=Math.max(t.phi1,t.phi2)-y,m=Math.ceil(p/90),O=new Array(m),l=r,T=e,v=0;v<m;v++){var f=c(t.phi1,t.phi2,v/m),N=c(t.phi1,t.phi2,(v+1)/m),x=N-f,d=4/3*Math.tan(x*h/4),E=[Math.cos(f*h)-d*Math.sin(f*h),Math.sin(f*h)+d*Math.cos(f*h)],A=E[0],C=E[1],M=[Math.cos(N*h),Math.sin(N*h)],R=M[0],g=M[1],I=[R+d*Math.sin(N*h),g-d*Math.cos(N*h)],S=I[0],L=I[1];O[v]={relative:t.relative,type:_.CURVE_TO};var H=function(r,e){var a=i([r*t.rX,e*t.rY],t.xRot),n=a[0],o=a[1];return [t.cX+n,t.cY+o]};a=H(A,C),O[v].x1=a[0],O[v].y1=a[1],n=H(S,L),O[v].x2=n[0],O[v].y2=n[1],s=H(R,g),O[v].x=s[0],O[v].y=s[1],t.relative&&(O[v].x1-=l,O[v].y1-=T,O[v].x2-=l,O[v].y2-=T,O[v].x-=l,O[v].y-=T),l=(u=[O[v].x,O[v].y])[0],T=u[1];}return O}(t,t.relative?0:r,t.relative?0:e):t}))},t.ANNOTATE_ARCS=function(){return u((function(t,r,e){return t.relative&&(r=0,e=0),_.ARC===t.type&&o(t,r,e),t}))},t.CLONE=l,t.CALCULATE_BOUNDS=function(){var t=function(t){var r={};for(var e in t)r[e]=t[e];return r},i=r(),a=n(),h=e(),c=u((function(r,e,n){var u=h(a(i(t(r))));function O(t){t>c.maxX&&(c.maxX=t),t<c.minX&&(c.minX=t);}function l(t){t>c.maxY&&(c.maxY=t),t<c.minY&&(c.minY=t);}if(u.type&_.DRAWING_COMMANDS&&(O(e),l(n)),u.type&_.HORIZ_LINE_TO&&O(u.x),u.type&_.VERT_LINE_TO&&l(u.y),u.type&_.LINE_TO&&(O(u.x),l(u.y)),u.type&_.CURVE_TO){O(u.x),l(u.y);for(var T=0,v=p(e,u.x1,u.x2,u.x);T<v.length;T++){0<(w=v[T])&&1>w&&O(m(e,u.x1,u.x2,u.x,w));}for(var f=0,N=p(n,u.y1,u.y2,u.y);f<N.length;f++){0<(w=N[f])&&1>w&&l(m(n,u.y1,u.y2,u.y,w));}}if(u.type&_.ARC){O(u.x),l(u.y),o(u,e,n);for(var x=u.xRot/180*Math.PI,d=Math.cos(x)*u.rX,E=Math.sin(x)*u.rX,A=-Math.sin(x)*u.rY,C=Math.cos(x)*u.rY,M=u.phi1<u.phi2?[u.phi1,u.phi2]:-180>u.phi2?[u.phi2+360,u.phi1+360]:[u.phi2,u.phi1],R=M[0],g=M[1],I=function(t){var r=t[0],e=t[1],i=180*Math.atan2(e,r)/Math.PI;return i<R?i+360:i},S=0,L=s(A,-d,0).map(I);S<L.length;S++){(w=L[S])>R&&w<g&&O(y(u.cX,d,A,w));}for(var H=0,U=s(C,-E,0).map(I);H<U.length;H++){var w;(w=U[H])>R&&w<g&&l(y(u.cY,E,C,w));}}return r}));return c.minX=1/0,c.maxX=-1/0,c.minY=1/0,c.maxY=-1/0,c};}(u||(u={}));var O,l=function(){function t(){}return t.prototype.round=function(t){return this.transform(u.ROUND(t))},t.prototype.toAbs=function(){return this.transform(u.TO_ABS())},t.prototype.toRel=function(){return this.transform(u.TO_REL())},t.prototype.normalizeHVZ=function(t,r,e){return this.transform(u.NORMALIZE_HVZ(t,r,e))},t.prototype.normalizeST=function(){return this.transform(u.NORMALIZE_ST())},t.prototype.qtToC=function(){return this.transform(u.QT_TO_C())},t.prototype.aToC=function(){return this.transform(u.A_TO_C())},t.prototype.sanitize=function(t){return this.transform(u.SANITIZE(t))},t.prototype.translate=function(t,r){return this.transform(u.TRANSLATE(t,r))},t.prototype.scale=function(t,r){return this.transform(u.SCALE(t,r))},t.prototype.rotate=function(t,r,e){return this.transform(u.ROTATE(t,r,e))},t.prototype.matrix=function(t,r,e,i,a,n){return this.transform(u.MATRIX(t,r,e,i,a,n))},t.prototype.skewX=function(t){return this.transform(u.SKEW_X(t))},t.prototype.skewY=function(t){return this.transform(u.SKEW_Y(t))},t.prototype.xSymmetry=function(t){return this.transform(u.X_AXIS_SYMMETRY(t))},t.prototype.ySymmetry=function(t){return this.transform(u.Y_AXIS_SYMMETRY(t))},t.prototype.annotateArcs=function(){return this.transform(u.ANNOTATE_ARCS())},t}(),T=function(t){return " "===t||"\t"===t||"\r"===t||"\n"===t},v=function(t){return "0".charCodeAt(0)<=t.charCodeAt(0)&&t.charCodeAt(0)<="9".charCodeAt(0)},f=function(t){function e(){var r=t.call(this)||this;return r.curNumber="",r.curCommandType=-1,r.curCommandRelative=!1,r.canParseCommandOrComma=!0,r.curNumberHasExp=!1,r.curNumberHasExpDigits=!1,r.curNumberHasDecimal=!1,r.curArgs=[],r}return r(e,t),e.prototype.finish=function(t){if(void 0===t&&(t=[]),this.parse(" ",t),0!==this.curArgs.length||!this.canParseCommandOrComma)throw new SyntaxError("Unterminated command at the path end.");return t},e.prototype.parse=function(t,r){var e=this;void 0===r&&(r=[]);for(var i=function(t){r.push(t),e.curArgs.length=0,e.canParseCommandOrComma=!0;},a=0;a<t.length;a++){var n=t[a],o=!(this.curCommandType!==_.ARC||3!==this.curArgs.length&&4!==this.curArgs.length||1!==this.curNumber.length||"0"!==this.curNumber&&"1"!==this.curNumber),s=v(n)&&("0"===this.curNumber&&"0"===n||o);if(!v(n)||s)if("e"!==n&&"E"!==n)if("-"!==n&&"+"!==n||!this.curNumberHasExp||this.curNumberHasExpDigits)if("."!==n||this.curNumberHasExp||this.curNumberHasDecimal||o){if(this.curNumber&&-1!==this.curCommandType){var u=Number(this.curNumber);if(isNaN(u))throw new SyntaxError("Invalid number ending at "+a);if(this.curCommandType===_.ARC)if(0===this.curArgs.length||1===this.curArgs.length){if(0>u)throw new SyntaxError('Expected positive number, got "'+u+'" at index "'+a+'"')}else if((3===this.curArgs.length||4===this.curArgs.length)&&"0"!==this.curNumber&&"1"!==this.curNumber)throw new SyntaxError('Expected a flag, got "'+this.curNumber+'" at index "'+a+'"');this.curArgs.push(u),this.curArgs.length===N[this.curCommandType]&&(_.HORIZ_LINE_TO===this.curCommandType?i({type:_.HORIZ_LINE_TO,relative:this.curCommandRelative,x:u}):_.VERT_LINE_TO===this.curCommandType?i({type:_.VERT_LINE_TO,relative:this.curCommandRelative,y:u}):this.curCommandType===_.MOVE_TO||this.curCommandType===_.LINE_TO||this.curCommandType===_.SMOOTH_QUAD_TO?(i({type:this.curCommandType,relative:this.curCommandRelative,x:this.curArgs[0],y:this.curArgs[1]}),_.MOVE_TO===this.curCommandType&&(this.curCommandType=_.LINE_TO)):this.curCommandType===_.CURVE_TO?i({type:_.CURVE_TO,relative:this.curCommandRelative,x1:this.curArgs[0],y1:this.curArgs[1],x2:this.curArgs[2],y2:this.curArgs[3],x:this.curArgs[4],y:this.curArgs[5]}):this.curCommandType===_.SMOOTH_CURVE_TO?i({type:_.SMOOTH_CURVE_TO,relative:this.curCommandRelative,x2:this.curArgs[0],y2:this.curArgs[1],x:this.curArgs[2],y:this.curArgs[3]}):this.curCommandType===_.QUAD_TO?i({type:_.QUAD_TO,relative:this.curCommandRelative,x1:this.curArgs[0],y1:this.curArgs[1],x:this.curArgs[2],y:this.curArgs[3]}):this.curCommandType===_.ARC&&i({type:_.ARC,relative:this.curCommandRelative,rX:this.curArgs[0],rY:this.curArgs[1],xRot:this.curArgs[2],lArcFlag:this.curArgs[3],sweepFlag:this.curArgs[4],x:this.curArgs[5],y:this.curArgs[6]})),this.curNumber="",this.curNumberHasExpDigits=!1,this.curNumberHasExp=!1,this.curNumberHasDecimal=!1,this.canParseCommandOrComma=!0;}if(!T(n))if(","===n&&this.canParseCommandOrComma)this.canParseCommandOrComma=!1;else if("+"!==n&&"-"!==n&&"."!==n)if(s)this.curNumber=n,this.curNumberHasDecimal=!1;else {if(0!==this.curArgs.length)throw new SyntaxError("Unterminated command at index "+a+".");if(!this.canParseCommandOrComma)throw new SyntaxError('Unexpected character "'+n+'" at index '+a+". Command cannot follow comma");if(this.canParseCommandOrComma=!1,"z"!==n&&"Z"!==n)if("h"===n||"H"===n)this.curCommandType=_.HORIZ_LINE_TO,this.curCommandRelative="h"===n;else if("v"===n||"V"===n)this.curCommandType=_.VERT_LINE_TO,this.curCommandRelative="v"===n;else if("m"===n||"M"===n)this.curCommandType=_.MOVE_TO,this.curCommandRelative="m"===n;else if("l"===n||"L"===n)this.curCommandType=_.LINE_TO,this.curCommandRelative="l"===n;else if("c"===n||"C"===n)this.curCommandType=_.CURVE_TO,this.curCommandRelative="c"===n;else if("s"===n||"S"===n)this.curCommandType=_.SMOOTH_CURVE_TO,this.curCommandRelative="s"===n;else if("q"===n||"Q"===n)this.curCommandType=_.QUAD_TO,this.curCommandRelative="q"===n;else if("t"===n||"T"===n)this.curCommandType=_.SMOOTH_QUAD_TO,this.curCommandRelative="t"===n;else {if("a"!==n&&"A"!==n)throw new SyntaxError('Unexpected character "'+n+'" at index '+a+".");this.curCommandType=_.ARC,this.curCommandRelative="a"===n;}else r.push({type:_.CLOSE_PATH}),this.canParseCommandOrComma=!0,this.curCommandType=-1;}else this.curNumber=n,this.curNumberHasDecimal="."===n;}else this.curNumber+=n,this.curNumberHasDecimal=!0;else this.curNumber+=n;else this.curNumber+=n,this.curNumberHasExp=!0;else this.curNumber+=n,this.curNumberHasExpDigits=this.curNumberHasExp;}return r},e.prototype.transform=function(t){return Object.create(this,{parse:{value:function(r,e){void 0===e&&(e=[]);for(var i=0,a=Object.getPrototypeOf(this).parse.call(this,r);i<a.length;i++){var n=a[i],o=t(n);Array.isArray(o)?e.push.apply(e,o):e.push(o);}return e}}})},e}(l),_=function(t){function i(r){var e=t.call(this)||this;return e.commands="string"==typeof r?i.parse(r):r,e}return r(i,t),i.prototype.encode=function(){return i.encode(this.commands)},i.prototype.getBounds=function(){var t=u.CALCULATE_BOUNDS();return this.transform(t),t},i.prototype.transform=function(t){for(var r=[],e=0,i=this.commands;e<i.length;e++){var a=t(i[e]);Array.isArray(a)?r.push.apply(r,a):r.push(a);}return this.commands=r,this},i.encode=function(t){return e(t)},i.parse=function(t){var r=new f,e=[];return r.parse(t,e),r.finish(e),e},i.CLOSE_PATH=1,i.MOVE_TO=2,i.HORIZ_LINE_TO=4,i.VERT_LINE_TO=8,i.LINE_TO=16,i.CURVE_TO=32,i.SMOOTH_CURVE_TO=64,i.QUAD_TO=128,i.SMOOTH_QUAD_TO=256,i.ARC=512,i.LINE_COMMANDS=i.LINE_TO|i.HORIZ_LINE_TO|i.VERT_LINE_TO,i.DRAWING_COMMANDS=i.HORIZ_LINE_TO|i.VERT_LINE_TO|i.LINE_TO|i.CURVE_TO|i.SMOOTH_CURVE_TO|i.QUAD_TO|i.SMOOTH_QUAD_TO|i.ARC,i}(l),N=((O={})[_.MOVE_TO]=2,O[_.LINE_TO]=2,O[_.HORIZ_LINE_TO]=1,O[_.VERT_LINE_TO]=1,O[_.CLOSE_PATH]=0,O[_.QUAD_TO]=4,O[_.SMOOTH_QUAD_TO]=2,O[_.CURVE_TO]=6,O[_.SMOOTH_CURVE_TO]=4,O[_.ARC]=7,O);

    function drawMarkers(context, element, points, svgTransform) {
        if (points.length === 0) {
            return;
        }
        const startPt = points[0];
        const endPt = points[points.length - 1];
        // start marker
        const markerStartId = getIdFromUrl(element.getAttribute('marker-start'));
        const markerStartElement = markerStartId
            ? context.idElements[markerStartId]
            : null;
        // marker-start is only rendered when there are at least two points
        if (markerStartElement && points.length > 1) {
            let angle = markerStartElement.orientAngle.baseVal.value;
            const nextPt = points[1];
            const orientAttr = markerStartElement.getAttribute('orient');
            if (orientAttr === 'auto' || orientAttr === 'auto-start-reverse') {
                const reverse = orientAttr === 'auto' ? 0 : 180;
                const prevPt = points[points.length - 2];
                if (isClosedPath(points)) {
                    // https://www.w3.org/TR/SVG11/painting.html#OrientAttribute
                    // use angle bisector of incoming and outgoing angle
                    angle = getBisectingAngle(prevPt, endPt, nextPt) - reverse;
                }
                else {
                    const vOut = { x: nextPt.x - startPt.x, y: nextPt.y - startPt.y };
                    angle = getAngle({ x: 1, y: 0 }, vOut) - reverse;
                }
            }
            const matrix = context.sourceSvg
                .createSVGMatrix()
                .translate(startPt.x, startPt.y)
                .rotate(angle)
                .scale(getScaleFactor(context, markerStartElement, element));
            const combinedMatrix = svgTransform ? svgTransform.matrix.multiply(matrix) : matrix;
            const markerTransform = context.sourceSvg.createSVGTransformFromMatrix(combinedMatrix);
            context.processElement(context, markerStartElement, markerTransform);
        }
        // end marker
        const markerEndId = getIdFromUrl(element.getAttribute('marker-end'));
        const markerEndElement = markerEndId
            ? context.idElements[markerEndId]
            : null;
        // marker-end is also rendered if the path has only one point
        if (markerEndElement) {
            let angle = markerEndElement.orientAngle.baseVal.value;
            if (points.length > 1) {
                const orientAttr = markerEndElement.getAttribute('orient');
                if (orientAttr === 'auto' || orientAttr === 'auto-start-reverse') {
                    // by spec, "auto-start-reverse" has no effect on marker end
                    const prevPt = points[points.length - 2];
                    if (isClosedPath(points)) {
                        // https://www.w3.org/TR/SVG11/painting.html#OrientAttribute
                        // use angle bisector of incoming and outgoing angle
                        const nextPt = points[1]; // start and end points are equal, take second point
                        angle = getBisectingAngle(prevPt, endPt, nextPt);
                    }
                    else {
                        const vIn = { x: endPt.x - prevPt.x, y: endPt.y - prevPt.y };
                        angle = getAngle({ x: 1, y: 0 }, vIn);
                    }
                }
            }
            const matrix = context.sourceSvg
                .createSVGMatrix()
                .translate(endPt.x, endPt.y)
                .rotate(angle)
                .scale(getScaleFactor(context, markerEndElement, element));
            const combinedMatrix = svgTransform ? svgTransform.matrix.multiply(matrix) : matrix;
            const markerTransform = context.sourceSvg.createSVGTransformFromMatrix(combinedMatrix);
            context.processElement(context, markerEndElement, markerTransform);
        }
        // mid marker(s)
        const markerMidId = getIdFromUrl(element.getAttribute('marker-mid'));
        const markerMidElement = markerMidId
            ? context.idElements[markerMidId]
            : null;
        if (markerMidElement && points.length > 2) {
            for (let i = 0; i < points.length; i++) {
                const loc = points[i];
                if (i === 0 || i === points.length - 1) {
                    // mid markers are not drawn on first or last point
                    continue;
                }
                let angle = markerMidElement.orientAngle.baseVal.value;
                const orientAttr = markerMidElement.getAttribute('orient');
                if (orientAttr === 'auto' || orientAttr === 'auto-start-reverse') {
                    // by spec, "auto-start-reverse" has no effect on marker mid
                    const prevPt = points[i - 1];
                    const nextPt = points[i + 1];
                    // https://www.w3.org/TR/SVG11/painting.html#OrientAttribute
                    // use angle bisector of incoming and outgoing angle
                    angle = getBisectingAngle(prevPt, loc, nextPt);
                }
                const matrix = context.sourceSvg
                    .createSVGMatrix()
                    .translate(loc.x, loc.y)
                    .rotate(angle)
                    .scale(getScaleFactor(context, markerMidElement, element));
                const combinedMatrix = svgTransform ? svgTransform.matrix.multiply(matrix) : matrix;
                const markerTransform = context.sourceSvg.createSVGTransformFromMatrix(combinedMatrix);
                context.processElement(context, markerMidElement, markerTransform);
            }
        }
    }
    /**
     * Consider scaled coordinate system for markerWidth/markerHeight.
     */
    function getScaleFactor(context, marker, referrer) {
        const markerUnits = marker.getAttribute('markerUnits');
        let scaleFactor = 1;
        if (!markerUnits || markerUnits === 'strokeWidth') {
            // default is strokeWidth by SVG spec
            const strokeWidth = getEffectiveAttribute(context, referrer, 'stroke-width');
            if (strokeWidth) {
                scaleFactor = convertToPixelUnit(context, referrer, strokeWidth, 'stroke-width');
            }
        }
        return scaleFactor;
    }
    /**
     * Whether the path is closed, i.e. the start and end points are identical
     */
    function isClosedPath(points) {
        return equals(points[0], points[points.length - 1]);
    }
    /**
     * Returns the bisection angle of the angle that is spanned by the given points.
     * @param prevPt The point from which the incoming flank is pointing
     * @param crossingPt The anchor point of the angle
     * @param nextPt Th point to which the outgoing flank is pointing
     * @returns The bisecting angle
     */
    function getBisectingAngle(prevPt, crossingPt, nextPt) {
        const vIn = { x: nextPt.x - crossingPt.x, y: nextPt.y - crossingPt.y };
        const vOut = { x: prevPt.x - crossingPt.x, y: prevPt.y - crossingPt.y };
        // the relative angle between the two vectors
        const vectorAngle = getAngle(vIn, vOut);
        // calculate the absolute angle of the vectors considering the x-axis as reference
        const refPoint = { x: crossingPt.x + 1, y: crossingPt.y };
        const refVector = { x: refPoint.x - crossingPt.x, y: refPoint.y - crossingPt.y };
        const refAngle = getAngle(vIn, refVector);
        // return the absolute bisector
        return getOppositeAngle(vectorAngle) / 2 - refAngle;
    }
    /**
     * Returns the opposite angle of the line. Considers the direction of the angle
     * (i.e. positive for clockwise, negative for counter-clickwise).
     */
    function getOppositeAngle(angle) {
        return angle - Math.sign(angle) * 180;
    }
    /**
     * Returns the signed angle between the vectors (i.e. positive for clockwise,
     * negative for counter-clickwise).
     * @param v1 2-dimensional vector
     * @param v2 2-dimensional vector
     * @returns The signed angle between the vectors
     */
    function getAngle(v1, v2) {
        const a1 = Math.atan2(v1.y, v1.x);
        const a2 = Math.atan2(v2.y, v2.x);
        const angle = a2 - a1;
        const K = -Math.sign(angle) * Math.PI * 2;
        const a = Math.abs(K + angle) < Math.abs(angle) ? K + angle : angle;
        return Math.round((360 * a) / (Math.PI * 2));
    }

    function drawPath(context, path, svgTransform) {
        const dataAttrs = path.getAttribute('d');
        const pathData = 
        // Parse path data and convert to absolute coordinates
        new _(dataAttrs)
            .toAbs()
            // Normalize H and V to L commands - those cannot work with how we draw transformed paths otherwise
            .transform(u.NORMALIZE_HVZ())
            // Normalize S and T to Q and C commands - Rough.js has a bug with T where it expects 4 parameters instead of 2
            .transform(u.NORMALIZE_ST());
        // If there's a transform, transform the whole path accordingly
        const transformedPathData = new _(
        // clone the commands, we might need them untransformed for markers
        pathData.commands.map(cmd => Object.assign({}, cmd)));
        if (svgTransform) {
            transformedPathData.transform(u.MATRIX(svgTransform.matrix.a, svgTransform.matrix.b, svgTransform.matrix.c, svgTransform.matrix.d, svgTransform.matrix.e, svgTransform.matrix.f));
        }
        const encodedPathData = e(transformedPathData.commands);
        if (encodedPathData.indexOf('undefined') !== -1) {
            // DEBUG STUFF
            console.error('broken path data');
            return;
        }
        const pathSketch = sketchPath(context, encodedPathData, parseStyleConfig(context, path, svgTransform));
        appendPatternPaint(context, path, () => {
            const proxy = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            proxy.setAttribute('d', encodedPathData);
            return proxy;
        });
        appendSketchElement(context, path, pathSketch);
        // https://www.w3.org/TR/SVG11/painting.html#MarkerProperties
        // Note that for a ‘path’ element which ends with a closed sub-path,
        // the last vertex is the same as the initial vertex on the given
        // sub-path (same applies to polygon).
        const points = [];
        let currentSubPathBegin;
        pathData.commands.forEach(cmd => {
            switch (cmd.type) {
                case _.MOVE_TO: {
                    const p = { x: cmd.x, y: cmd.y };
                    points.push(p);
                    // each moveto starts a new subpath
                    currentSubPathBegin = p;
                    break;
                }
                case _.LINE_TO:
                case _.QUAD_TO:
                case _.SMOOTH_QUAD_TO:
                case _.CURVE_TO:
                case _.SMOOTH_CURVE_TO:
                case _.ARC:
                    points.push({ x: cmd.x, y: cmd.y });
                    break;
                case _.HORIZ_LINE_TO:
                    points.push({ x: cmd.x, y: 0 });
                    break;
                case _.VERT_LINE_TO:
                    points.push({ x: 0, y: cmd.y });
                    break;
                case _.CLOSE_PATH:
                    if (currentSubPathBegin) {
                        points.push(currentSubPathBegin);
                    }
                    break;
            }
        });
        drawMarkers(context, path, points, svgTransform);
    }
    function applyPathClip(context, path, container, svgTransform) {
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        clip.setAttribute('d', path.getAttribute('d'));
        applyTransform(context, svgTransform, clip);
        container.appendChild(clip);
    }

    function drawPolygon(context, polygon, svgTransform) {
        const points = getPointsArray(polygon);
        const transformed = points.map(p => {
            const pt = applyMatrix(p, svgTransform);
            return [pt.x, pt.y];
        });
        const polygonSketch = context.rc.polygon(transformed, parseStyleConfig(context, polygon, svgTransform));
        appendPatternPaint(context, polygon, () => {
            const proxy = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            proxy.setAttribute('points', transformed.join(' '));
            return proxy;
        });
        appendSketchElement(context, polygon, polygonSketch);
        // https://www.w3.org/TR/SVG11/painting.html#MarkerProperties
        // Note that for a ‘path’ element which ends with a closed sub-path,
        // the last vertex is the same as the initial vertex on the given
        // sub-path (same applies to polygon).
        if (points.length > 0) {
            points.push(points[0]);
            drawMarkers(context, polygon, points, svgTransform);
        }
    }
    function applyPolygonClip(context, polygon, container, svgTransform) {
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        clip.setAttribute('points', polygon.getAttribute('points'));
        applyTransform(context, svgTransform, clip);
        container.appendChild(clip);
    }

    function drawRect(context, rect, svgTransform) {
        const x = rect.x.baseVal.value;
        const y = rect.y.baseVal.value;
        const width = rect.width.baseVal.value;
        const height = rect.height.baseVal.value;
        if (width === 0 || height === 0) {
            // zero-width or zero-height rect will not be rendered
            return;
        }
        // Negative values are an error and result in the default value, and clamp both values to half their sides' lengths
        let rx = rect.hasAttribute('rx') ? Math.min(Math.max(0, rect.rx.baseVal.value), width / 2) : null;
        let ry = rect.hasAttribute('ry') ? Math.min(Math.max(0, rect.ry.baseVal.value), height / 2) : null;
        if (rx !== null || ry !== null) {
            // If only one of the two values is specified, the other has the same value
            rx = rx === null ? ry : rx;
            ry = ry === null ? rx : ry;
        }
        // the transformed, rectangular bounds
        const p1 = applyMatrix({ x, y }, svgTransform);
        const p2 = applyMatrix({ x: x + width, y: y + height }, svgTransform);
        const transformedWidth = p2.x - p1.x;
        const transformedHeight = p2.y - p1.y;
        const transformedBounds = { x: p1.x, y: p1.y, w: transformedWidth, h: transformedHeight };
        if ((isIdentityTransform(svgTransform) || isTranslationTransform(svgTransform)) && !rx && !ry) {
            // Simple case; just a rectangle
            const sketchRect = context.rc.rectangle(transformedBounds.x, transformedBounds.y, transformedBounds.w, transformedBounds.h, parseStyleConfig(context, rect, svgTransform));
            applyPatternPaint(context, rect, transformedBounds);
            appendSketchElement(context, rect, sketchRect);
        }
        else {
            let path = '';
            if (rx !== null && ry !== null) {
                const factor = (4 / 3) * (Math.sqrt(2) - 1);
                // Construct path for the rounded rectangle
                // perform an absolute moveto operation to location (x+rx,y), where x is the value of the ‘rect’ element's ‘x’ attribute converted to user space, rx is the effective value of the ‘rx’ attribute converted to user space and y is the value of the ‘y’ attribute converted to user space
                const p1 = applyMatrix({ x: x + rx, y }, svgTransform);
                path += `M ${str(p1)}`;
                // perform an absolute horizontal lineto operation to location (x+width-rx,y), where width is the ‘rect’ element's ‘width’ attribute converted to user space
                const p2 = applyMatrix({ x: x + width - rx, y }, svgTransform);
                path += `L ${str(p2)}`;
                // perform an absolute elliptical arc operation to coordinate (x+width,y+ry), where the effective values for the ‘rx’ and ‘ry’ attributes on the ‘rect’ element converted to user space are used as the rx and ry attributes on the elliptical arc command, respectively, the x-axis-rotation is set to zero, the large-arc-flag is set to zero, and the sweep-flag is set to one
                const p3c1 = applyMatrix({ x: x + width - rx + factor * rx, y }, svgTransform);
                const p3c2 = applyMatrix({ x: x + width, y: y + factor * ry }, svgTransform);
                const p3 = applyMatrix({ x: x + width, y: y + ry }, svgTransform);
                path += `C ${str(p3c1)} ${str(p3c2)} ${str(p3)}`; // We cannot use the arc command, since we no longer draw in the expected coordinates. So approximate everything with lines and béziers
                // perform a absolute vertical lineto to location (x+width,y+height-ry), where height is the ‘rect’ element's ‘height’ attribute converted to user space
                const p4 = applyMatrix({ x: x + width, y: y + height - ry }, svgTransform);
                path += `L ${str(p4)}`;
                // perform an absolute elliptical arc operation to coordinate (x+width-rx,y+height)
                const p5c1 = applyMatrix({ x: x + width, y: y + height - ry + factor * ry }, svgTransform);
                const p5c2 = applyMatrix({ x: x + width - factor * rx, y: y + height }, svgTransform);
                const p5 = applyMatrix({ x: x + width - rx, y: y + height }, svgTransform);
                path += `C ${str(p5c1)} ${str(p5c2)} ${str(p5)}`;
                // perform an absolute horizontal lineto to location (x+rx,y+height)
                const p6 = applyMatrix({ x: x + rx, y: y + height }, svgTransform);
                path += `L ${str(p6)}`;
                // perform an absolute elliptical arc operation to coordinate (x,y+height-ry)
                const p7c1 = applyMatrix({ x: x + rx - factor * rx, y: y + height }, svgTransform);
                const p7c2 = applyMatrix({ x, y: y + height - factor * ry }, svgTransform);
                const p7 = applyMatrix({ x, y: y + height - ry }, svgTransform);
                path += `C ${str(p7c1)} ${str(p7c2)} ${str(p7)}`;
                // perform an absolute absolute vertical lineto to location (x,y+ry)
                const p8 = applyMatrix({ x, y: y + ry }, svgTransform);
                path += `L ${str(p8)}`;
                // perform an absolute elliptical arc operation to coordinate (x+rx,y)
                const p9c1 = applyMatrix({ x, y: y + factor * ry }, svgTransform);
                const p9c2 = applyMatrix({ x: x + factor * rx, y }, svgTransform);
                path += `C ${str(p9c1)} ${str(p9c2)} ${str(p1)}`;
                path += 'z';
            }
            else {
                // No rounding, so just construct the respective path as a simple polygon
                const p1 = applyMatrix({ x, y }, svgTransform);
                const p2 = applyMatrix({ x: x + width, y }, svgTransform);
                const p3 = applyMatrix({ x: x + width, y: y + height }, svgTransform);
                const p4 = applyMatrix({ x, y: y + height }, svgTransform);
                path += `M ${str(p1)}`;
                path += `L ${str(p2)}`;
                path += `L ${str(p3)}`;
                path += `L ${str(p4)}`;
                path += `z`;
            }
            const result = sketchPath(context, path, parseStyleConfig(context, rect, svgTransform));
            applyPatternPaint(context, rect, transformedBounds);
            appendSketchElement(context, rect, result);
        }
    }
    function applyPatternPaint(context, rect, { x, y, w, h }) {
        appendPatternPaint(context, rect, () => {
            const proxy = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            proxy.x.baseVal.value = x;
            proxy.y.baseVal.value = y;
            proxy.width.baseVal.value = w;
            proxy.height.baseVal.value = h;
            return proxy;
        });
    }
    function applyRectClip(context, rect, container, svgTransform) {
        const x = rect.x.baseVal.value;
        const y = rect.y.baseVal.value;
        const width = rect.width.baseVal.value;
        const height = rect.height.baseVal.value;
        if (width === 0 || height === 0) {
            // zero-width or zero-height rect will not be rendered
            return;
        }
        const rx = rect.hasAttribute('rx') ? rect.rx.baseVal.value : null;
        const ry = rect.hasAttribute('ry') ? rect.ry.baseVal.value : null;
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clip.x.baseVal.value = x;
        clip.y.baseVal.value = y;
        clip.width.baseVal.value = width;
        clip.height.baseVal.value = height;
        if (rx) {
            clip.rx.baseVal.value = rx;
        }
        if (ry) {
            clip.ry.baseVal.value = ry;
        }
        applyTransform(context, svgTransform, clip);
        container.appendChild(clip);
    }

    /**
     * Applies the clip-path to the CanvasContext.
     */
    function applyClipPath(context, owner, clipPathAttr, svgTransform) {
        const id = getIdFromUrl(clipPathAttr);
        if (!id) {
            return;
        }
        const clipPath = context.idElements[id];
        if (!clipPath) {
            return;
        }
        // TODO clipPath: consider clipPathUnits
        //  create clipPath defs
        const targetDefs = getDefsElement(context);
        // unfortunately, we cannot reuse clip-paths due to the 'global transform' approach
        const sketchClipPathId = `${id}_${targetDefs.childElementCount}`;
        const clipContainer = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipContainer.id = sketchClipPathId;
        storeSketchClipId(owner, sketchClipPathId);
        // traverse clip-path elements in DFS
        const stack = [];
        const children = getNodeChildren(clipPath);
        for (let i = children.length - 1; i >= 0; i--) {
            const childElement = children[i];
            const childTransform = getCombinedTransform(context, childElement, svgTransform);
            stack.push({ element: childElement, transform: childTransform });
        }
        while (stack.length > 0) {
            const { element, transform } = stack.pop();
            try {
                applyElementClip(context, element, clipContainer, transform);
            }
            catch (e) {
                console.error(e);
            }
            if (element.tagName === 'defs' ||
                element.tagName === 'svg' ||
                element.tagName === 'clipPath' ||
                element.tagName === 'text') {
                // some elements are ignored on clippaths
                continue;
            }
            // process children
            const children = getNodeChildren(element);
            for (let i = children.length - 1; i >= 0; i--) {
                const childElement = children[i];
                const childTransform = getCombinedTransform(context, childElement, transform);
                stack.push({ element: childElement, transform: childTransform });
            }
        }
        if (clipContainer.childNodes.length > 0) {
            // add the clip-path only if it contains converted elements
            // some elements are not yet supported
            targetDefs.appendChild(clipContainer);
        }
    }
    /**
     * Creates a clip element and appends it to the given container.
     */
    function applyElementClip(context, element, container, svgTransform) {
        switch (element.tagName) {
            case 'rect':
                applyRectClip(context, element, container, svgTransform);
                break;
            case 'circle':
                applyCircleClip(context, element, container, svgTransform);
                break;
            case 'ellipse':
                applyEllipseClip(context, element, container, svgTransform);
                break;
            case 'polygon':
                applyPolygonClip(context, element, container, svgTransform);
                break;
            case 'path':
                applyPathClip(context, element, container, svgTransform);
                break;
        }
    }
    /**
     * Store clippath-id on each child for <g> elements, or on the owner itself for other
     * elements.
     *
     * <g> elements are skipped in the processing loop, thus the clip-path id must be stored
     * on the child elements.
     */
    function storeSketchClipId(element, id) {
        if (element.tagName !== 'g') {
            element.setAttribute(SKETCH_CLIP_ATTRIBUTE, id);
            return;
        }
        const stack = [];
        const children = getNodeChildren(element);
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
        }
        while (stack.length > 0) {
            const element = stack.pop();
            element.setAttribute(SKETCH_CLIP_ATTRIBUTE, id);
            const children = getNodeChildren(element);
            for (let i = children.length - 1; i >= 0; i--) {
                stack.push(children[i]);
            }
        }
    }

    function drawForeignObject(context, foreignObject, svgTransform) {
        const foreignObjectClone = foreignObject.cloneNode(true);
        const container = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        // foreignObject often relies on CSS styling, and just copying the <style> element
        // won't do the trick, because sketching the SVG rebuilds the entire element tree, thus
        // existing CSS rules don't apply anymore in most cases.
        //
        // To to make the MOST SIMPLE cases of foreignObject text elements work better,
        // try to apply the computed style on the new SVG container.
        // To properly fix it, we'd need to inline all computed styles recursively on the
        // foreignObject tree.
        const copyStyleProperties = [
            'color',
            'font-family',
            'font-size',
            'font-style',
            'font-variant',
            'font-weight'
        ];
        const style = getComputedStyle(foreignObject);
        for (const prop of copyStyleProperties) {
            container.style.setProperty(prop, style.getPropertyValue(prop));
        }
        // transform is already considered in svgTransform
        foreignObjectClone.transform.baseVal.clear();
        // transform the foreignObject to its destination location
        applyTransform(context, svgTransform, container);
        container.appendChild(foreignObjectClone);
        appendSketchElement(context, foreignObjectClone, container);
    }

    function drawImage(context, svgImage, svgTransform) {
        const href = svgImage.href.baseVal;
        const x = svgImage.x.baseVal.value;
        const y = svgImage.y.baseVal.value;
        let width, height;
        if (svgImage.getAttribute('width') && svgImage.getAttribute('height')) {
            width = svgImage.width.baseVal.value;
            height = svgImage.height.baseVal.value;
        }
        if (href.startsWith('data:') && href.indexOf('image/svg+xml') !== -1) {
            // data:[<media type>][;charset=<character set>][;base64],<data>
            const dataUrlRegex = /^data:([^,]*),(.*)/;
            const match = dataUrlRegex.exec(href);
            if (match && match.length > 2) {
                const meta = match[1];
                let svgString = match[2];
                const isBase64 = meta.indexOf('base64') !== -1;
                const isUtf8 = meta.indexOf('utf8') !== -1;
                if (isBase64) {
                    svgString = atob(svgString);
                }
                if (!isUtf8) {
                    svgString = decodeURIComponent(svgString);
                }
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgString, 'image/svg+xml');
                const svg = doc.firstChild;
                let matrix = context.sourceSvg.createSVGMatrix().translate(x, y);
                matrix = svgTransform ? svgTransform.matrix.multiply(matrix) : matrix;
                context.processElement(context, svg, context.sourceSvg.createSVGTransformFromMatrix(matrix), width, height);
                return;
            }
        }
        else {
            const imageClone = svgImage.cloneNode();
            const container = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            applyTransform(context, svgTransform, container);
            container.appendChild(imageClone);
            appendSketchElement(context, svgImage, container);
        }
    }

    function drawLine(context, line, svgTransform) {
        const p1 = { x: line.x1.baseVal.value, y: line.y1.baseVal.value };
        const p2 = { x: line.x2.baseVal.value, y: line.y2.baseVal.value };
        const { x: tp1x, y: tp1y } = applyMatrix(p1, svgTransform);
        const { x: tp2x, y: tp2y } = applyMatrix(p2, svgTransform);
        if (tp1x === tp2x && tp1y === tp2y) {
            // zero-length line is not rendered
            return;
        }
        const lineSketch = context.rc.line(tp1x, tp1y, tp2x, tp2y, parseStyleConfig(context, line, svgTransform));
        appendPatternPaint(context, line, () => {
            const proxy = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            proxy.x1.baseVal.value = tp1x;
            proxy.y1.baseVal.value = tp1y;
            proxy.x2.baseVal.value = tp2x;
            proxy.y2.baseVal.value = tp2y;
            return proxy;
        });
        appendSketchElement(context, line, lineSketch);
        drawMarkers(context, line, [p1, p2], svgTransform);
    }

    function drawPolyline(context, polyline, svgTransform) {
        const points = getPointsArray(polyline);
        const transformed = points.map(p => {
            const pt = applyMatrix(p, svgTransform);
            return [pt.x, pt.y];
        });
        const style = parseStyleConfig(context, polyline, svgTransform);
        appendPatternPaint(context, polyline, () => {
            const proxy = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            proxy.setAttribute('points', transformed.join(' '));
            return proxy;
        });
        if (style.fill && style.fill !== 'none') {
            const fillStyle = Object.assign(Object.assign({}, style), { stroke: 'none' });
            appendSketchElement(context, polyline, context.rc.polygon(transformed, fillStyle));
        }
        appendSketchElement(context, polyline, context.rc.linearPath(transformed, style));
        drawMarkers(context, polyline, points, svgTransform);
    }

    function drawText(context, text, svgTransform) {
        const container = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        container.setAttribute('class', 'text-container');
        applyTransform(context, svgTransform, container);
        const textClone = text.cloneNode(true);
        if (textClone.transform.baseVal.numberOfItems > 0) {
            // remove transformation, since it is transformed globally by its parent container
            textClone.transform.baseVal.clear();
        }
        // clip-path is applied on the container
        textClone.removeAttribute('clip-path');
        const { cssFont, fontSize: effectiveFontSize } = getCssFont(context, text, true);
        textClone.setAttribute('style', concatStyleStrings(textClone.getAttribute('style'), cssFont));
        copyTextStyleAttributes(context, text, textClone);
        // apply styling to any tspan
        if (textClone.childElementCount > 0) {
            const children = getNodeChildren(textClone);
            const origChildren = getNodeChildren(text);
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child instanceof SVGTSpanElement) {
                    copyTextStyleAttributes(context, origChildren[i], child);
                }
            }
        }
        container.appendChild(textClone);
        appendSketchElement(context, text, container);
        // avoid text clipping by scaling the text when changing the font
        const useCustomFontFamily = context.fontFamily !== null;
        const hasClipPath = textClone.hasAttribute(SKETCH_CLIP_ATTRIBUTE);
        if (useCustomFontFamily && hasClipPath && effectiveFontSize) {
            fitFontSize(context, text, textClone, effectiveFontSize);
        }
    }
    /**
     * Applies a font-size on the clone such that the clone has a smaller width than the original element.
     * Only fits the width because the height is usually no problem wrt. clipping.
     */
    function fitFontSize(context, original, clone, effectiveFontSize) {
        const { width, height } = original.getBBox();
        if (width <= 0 || height <= 0) {
            return;
        }
        const fontSizePx = convertToPixelUnit(context, clone, effectiveFontSize, 'font-size');
        fitFontSizeCore(context, { w: width, h: height }, clone, fontSizePx);
    }
    /**
     * Recursively shrinks the font-size on the element until its width is smaller than the original width.
     */
    function fitFontSizeCore(context, originalSize, clone, fontSizePx) {
        const STEP_SIZE = 1;
        const { w: cloneWidth } = measureText(context, clone);
        if (cloneWidth < originalSize.w) {
            // fits original width
            return;
        }
        if (fontSizePx <= 1) {
            // already too small
            return;
        }
        // try a smaller size
        const newFontSize = fontSizePx - STEP_SIZE;
        clone.style.fontSize = `${newFontSize}px`;
        // check again
        fitFontSizeCore(context, originalSize, clone, newFontSize);
    }
    /**
     * @param asStyleString Formats the return value as inline style string
     */
    function getCssFont(context, text, asStyleString = false) {
        const effectiveAttributes = {};
        let cssFont = '';
        const fontStyle = getEffectiveAttribute(context, text, 'font-style', context.useElementContext);
        if (fontStyle) {
            cssFont += asStyleString ? `font-style: ${fontStyle};` : fontStyle;
            effectiveAttributes.fontStyle = fontStyle;
        }
        const fontWeight = getEffectiveAttribute(context, text, 'font-weight', context.useElementContext);
        if (fontWeight) {
            cssFont += asStyleString ? `font-weight: ${fontWeight};` : ` ${fontWeight}`;
            effectiveAttributes.fontWeight = fontWeight;
        }
        const fontSize = getEffectiveAttribute(context, text, 'font-size', context.useElementContext);
        if (fontSize) {
            cssFont += asStyleString ? `font-size: ${fontSize};` : ` ${fontSize}`;
            effectiveAttributes.fontSize = fontSize;
        }
        if (context.fontFamily) {
            cssFont += asStyleString ? `font-family: ${context.fontFamily};` : ` ${context.fontFamily}`;
            effectiveAttributes.fontFamiliy = context.fontFamily;
        }
        else {
            const fontFamily = getEffectiveAttribute(context, text, 'font-family', context.useElementContext);
            if (fontFamily) {
                cssFont += asStyleString ? `font-family: ${fontFamily};` : ` ${fontFamily}`;
                effectiveAttributes.fontFamiliy = fontFamily;
            }
        }
        cssFont = cssFont.trim();
        return Object.assign(Object.assign({}, effectiveAttributes), { cssFont });
    }
    function copyTextStyleAttributes(context, srcElement, tgtElement) {
        const stroke = getEffectiveAttribute(context, srcElement, 'stroke');
        const strokeWidth = stroke ? getEffectiveAttribute(context, srcElement, 'stroke-width') : null;
        const fill = getEffectiveAttribute(context, srcElement, 'fill');
        const dominantBaseline = getEffectiveAttribute(context, srcElement, 'dominant-baseline');
        const textAnchor = getEffectiveAttribute(context, srcElement, 'text-anchor', context.useElementContext);
        if (stroke) {
            tgtElement.setAttribute('stroke', stroke);
        }
        if (strokeWidth) {
            tgtElement.setAttribute('stroke-width', strokeWidth);
        }
        if (fill) {
            tgtElement.setAttribute('fill', fill);
        }
        if (textAnchor) {
            tgtElement.setAttribute('text-anchor', textAnchor);
        }
        if (dominantBaseline) {
            tgtElement.setAttribute('dominant-baseline', dominantBaseline);
        }
    }

    function drawUse(context, use, svgTransform) {
        let href = use.href.baseVal;
        if (href.startsWith('#')) {
            href = href.substring(1);
        }
        const defElement = context.idElements[href];
        if (defElement) {
            let useWidth, useHeight;
            if (use.getAttribute('width') && use.getAttribute('height')) {
                // Use elements can overwrite the width which is important if it is a nested SVG
                useWidth = use.width.baseVal.value;
                useHeight = use.height.baseVal.value;
            }
            // We need to account for x and y attributes as well. Those change where the element is drawn.
            // We can simply change the transform to include that.
            const x = use.x.baseVal.value;
            const y = use.y.baseVal.value;
            let matrix = context.sourceSvg.createSVGMatrix().translate(x, y);
            matrix = svgTransform ? svgTransform.matrix.multiply(matrix) : matrix;
            // the defsElement itself might have a transform that needs to be incorporated
            const elementTransform = context.sourceSvg.createSVGTransformFromMatrix(matrix);
            // use elements must be processed in their context, particularly regarding
            // the styling of them
            if (!context.useElementContext) {
                context.useElementContext = { root: use, referenced: defElement, parentContext: null };
            }
            else {
                const newContext = {
                    root: use,
                    referenced: defElement,
                    parentContext: Object.assign({}, context.useElementContext)
                };
                context.useElementContext = newContext;
            }
            // draw the referenced element
            context.processElement(context, defElement, getCombinedTransform(context, defElement, elementTransform), useWidth, useHeight);
            // restore default context
            if (context.useElementContext.parentContext) {
                context.useElementContext = context.useElementContext.parentContext;
            }
            else {
                context.useElementContext = null;
            }
        }
    }

    /**
     * Traverses the SVG in DFS and draws each element to the canvas.
     * @param root either an SVG- or g-element
     * @param width Use elements can overwrite width
     * @param height Use elements can overwrite height
     */
    function processRoot(context, root, svgTransform, width, height) {
        var _a, _b;
        // traverse svg in DFS
        const stack = [];
        const currentViewBox = { x: 0, y: 0, w: width !== null && width !== void 0 ? width : 0, h: height !== null && height !== void 0 ? height : 0 };
        if (root instanceof SVGSVGElement ||
            root instanceof SVGSymbolElement ||
            root instanceof SVGMarkerElement) {
            let rootX = 0;
            let rootY = 0;
            if (root instanceof SVGSymbolElement) {
                rootX = parseFloat((_a = root.getAttribute('x')) !== null && _a !== void 0 ? _a : '') || 0;
                rootY = parseFloat((_b = root.getAttribute('y')) !== null && _b !== void 0 ? _b : '') || 0;
                width = width !== null && width !== void 0 ? width : (parseFloat(root.getAttribute('width')) || void 0);
                height = height !== null && height !== void 0 ? height : (parseFloat(root.getAttribute('height')) || void 0);
            }
            else if (root instanceof SVGMarkerElement) {
                // markers use refX / refY which is applied after user-space transformation
                const mw = root.getAttribute('markerWidth');
                const mh = root.getAttribute('markerHeight');
                width = mw !== null ? parseFloat(mw) : 3; // marker-size is 3 by SVG spec
                height = mh !== null ? parseFloat(mh) : 3;
            }
            else if (root !== context.sourceSvg) {
                // apply translation of nested elements
                rootX = root.x.baseVal.value;
                rootY = root.y.baseVal.value;
            }
            let rootTransform = context.sourceSvg.createSVGMatrix();
            if (root.getAttribute('viewBox')) {
                const { x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight } = root.viewBox.baseVal;
                currentViewBox.x = viewBoxX;
                currentViewBox.y = viewBoxY;
                currentViewBox.w = viewBoxWidth;
                currentViewBox.h = viewBoxHeight;
                if (typeof width !== 'undefined' && typeof height !== 'undefined') {
                    // viewBox values might scale the SVGs content
                    const sx = width / viewBoxWidth;
                    const sy = height / viewBoxHeight;
                    const centerviewportX = rootX + width * 0.5;
                    const centerviewportY = rootY + height * 0.5;
                    const centerViewBoxX = viewBoxX + viewBoxWidth * 0.5;
                    const centerViewBoxY = viewBoxY + viewBoxHeight * 0.5;
                    // only support scaling from the center, e.g. xMidYMid
                    rootTransform = rootTransform.translate(centerviewportX, centerviewportY);
                    if (root.getAttribute('preserveAspectRatio') === 'none') {
                        rootTransform = rootTransform.scaleNonUniform(sx, sy);
                    }
                    else {
                        rootTransform = rootTransform.scale(Math.min(sx, sy));
                    }
                    rootTransform = rootTransform.translate(-centerViewBoxX, -centerViewBoxY);
                }
            }
            else {
                rootTransform = rootTransform.translate(rootX, rootY);
            }
            if (root instanceof SVGMarkerElement) {
                // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/refX#symbol
                // ref coordinates are interpreted as being in the coordinate system of the element contents,
                // after application of the viewBox and preserveAspectRatio attributes.
                rootTransform = rootTransform.translate(-root.refX.baseVal.value, -root.refY.baseVal.value);
            }
            const combinedMatrix = svgTransform
                ? svgTransform.matrix.multiply(rootTransform)
                : rootTransform;
            svgTransform = context.sourceSvg.createSVGTransformFromMatrix(combinedMatrix);
            // don't put the SVG itself into the stack, so start with the children of it
            const children = getNodeChildren(root);
            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];
                if (child instanceof SVGSymbolElement || child instanceof SVGMarkerElement) {
                    // symbols and marker can only be instantiated by specific elements
                    continue;
                }
                const childTransform = getCombinedTransform(context, child, svgTransform);
                stack.push({ element: child, transform: childTransform, viewBox: currentViewBox });
            }
        }
        else {
            stack.push({ element: root, transform: svgTransform, viewBox: currentViewBox });
        }
        while (stack.length > 0) {
            const { element, transform, viewBox } = stack.pop();
            // maybe draw the element
            try {
                context.viewBox = viewBox;
                drawElement(context, element, transform);
            }
            catch (e) {
                console.error(e);
            }
            if (element.tagName === 'defs' ||
                element.tagName === 'symbol' ||
                element.tagName === 'marker' ||
                element.tagName === 'svg' ||
                element.tagName === 'clipPath') {
                // Defs are prepocessed separately.
                // Symbols and marker can only be instantiated by specific elements.
                // Don't traverse the SVG element itself. This is done by drawElement -> processRoot.
                // ClipPaths are not drawn and processed separately.
                continue;
            }
            // process children
            const children = getNodeChildren(element);
            for (let i = children.length - 1; i >= 0; i--) {
                const childElement = children[i];
                const newTransform = getCombinedTransform(context, childElement, transform);
                stack.push({ element: childElement, transform: newTransform, viewBox });
            }
        }
    }
    function drawRoot(context, element, svgTransform) {
        let width = parseFloat(element.getAttribute('width'));
        let height = parseFloat(element.getAttribute('height'));
        if (isNaN(width) || isNaN(height)) {
            // use only if both are set
            width = height = undefined;
        }
        processRoot(context, element, svgTransform, width, height);
    }
    /**
     * The main switch to delegate drawing of `SVGElement`s
     * to different subroutines.
     */
    function drawElement(context, element, svgTransform) {
        if (isHidden(element)) {
            // just skip hidden elements
            return;
        }
        // possibly apply a clip on the canvas before drawing on it
        const clipPath = element.getAttribute('clip-path');
        if (clipPath) {
            applyClipPath(context, element, clipPath, svgTransform);
        }
        switch (element.tagName) {
            case 'svg':
            case 'symbol':
                drawRoot(context, element, svgTransform);
                break;
            case 'rect':
                drawRect(context, element, svgTransform);
                break;
            case 'path':
                drawPath(context, element, svgTransform);
                break;
            case 'use':
                drawUse(context, element, svgTransform);
                break;
            case 'line':
                drawLine(context, element, svgTransform);
                break;
            case 'circle':
                drawCircle(context, element, svgTransform);
                break;
            case 'ellipse':
                drawEllipse(context, element, svgTransform);
                break;
            case 'polyline':
                drawPolyline(context, element, svgTransform);
                break;
            case 'polygon':
                drawPolygon(context, element, svgTransform);
                break;
            case 'text':
                drawText(context, element, svgTransform);
                break;
            case 'image':
                drawImage(context, element, svgTransform);
                break;
            case 'foreignObject':
                drawForeignObject(context, element, svgTransform);
                break;
        }
    }

    function createPencilFilter() {
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'pencilTextureFilter');
        filter.setAttribute('x', '0%');
        filter.setAttribute('y', '0%');
        filter.setAttribute('width', '100%');
        filter.setAttribute('height', '100%');
        filter.setAttribute('filterUnits', 'objectBoundingBox');
        const feTurbulence = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
        feTurbulence.setAttribute('type', 'fractalNoise');
        feTurbulence.setAttribute('baseFrequency', '2');
        feTurbulence.setAttribute('numOctaves', '5');
        feTurbulence.setAttribute('stitchTiles', 'stitch');
        feTurbulence.setAttribute('result', 'f1');
        filter.appendChild(feTurbulence);
        const feColorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
        feColorMatrix.setAttribute('type', 'matrix');
        feColorMatrix.setAttribute('values', '0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 -1.5 1.5');
        feColorMatrix.setAttribute('result', 'f2');
        filter.appendChild(feColorMatrix);
        const feComposite = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
        feComposite.setAttribute('operator', 'in');
        feComposite.setAttribute('in', 'SourceGraphic');
        feComposite.setAttribute('in2', 'f2');
        feComposite.setAttribute('result', 'f3');
        filter.appendChild(feComposite);
        return filter;
    }

    /**
     * A simple random number generator that allows for seeding.
     */
    class RandomNumberGenerator {
        constructor(seed) {
            // since we already depend on Rough.js, we may just use its seedable RNG implementation
            this.rng = seed ? new Random(seed) : null;
        }
        /**
         * Returns a random number in the given range.
         */
        next(range) {
            var _a, _b;
            const rnd = (_b = (_a = this.rng) === null || _a === void 0 ? void 0 : _a.next()) !== null && _b !== void 0 ? _b : Math.random();
            if (range) {
                const min = range[0];
                const max = range[1];
                return rnd * (max - min) + min;
            }
            return rnd;
        }
    }

    /**
     * Svg2Roughjs parses an SVG and converts it to a hand-drawn sketch.
     */
    class Svg2Roughjs {
        /**
         * Set the SVG that should be sketched.
         */
        set svg(svg) {
            if (this.$svg !== svg) {
                this.$svg = svg;
                this.sourceSvgChanged();
            }
        }
        /**
         * Returns the SVG that should be sketched.
         */
        get svg() {
            return this.$svg;
        }
        /**
         * Sets the output format of the sketch.
         *
         * Applies only to instances that have been created with a
         * container as output element instead of an actual SVG or canvas
         * element.
         *
         * Throws when the given mode does not match the output element
         * with which this instance was created.
         */
        set outputType(type) {
            if (this.$outputType === type) {
                return;
            }
            const incompatible = (type === exports.OutputType.CANVAS && this.outputElement instanceof SVGSVGElement) ||
                (type === exports.OutputType.SVG && this.outputElement instanceof HTMLCanvasElement);
            if (incompatible) {
                throw new Error(`Output format ${type} incompatible with given output element ${this.outputElement.tagName}`);
            }
            this.$outputType = type;
        }
        /**
         * Returns the currently configured output type.
         */
        get outputType() {
            return this.$outputType;
        }
        /**
         * Sets the config object that is passed to Rough.js and considered
         * during rendering of the `SVGElement`s.
         *
         * Sets `fixedDecimalPlaceDigits` to `3` if not specified otherwise.
         */
        set roughConfig(config) {
            if (typeof config.fixedDecimalPlaceDigits === 'undefined') {
                config.fixedDecimalPlaceDigits = 3;
            }
            this.$roughConfig = config;
        }
        /**
         * Returns the currently configured rendering configuration.
         */
        get roughConfig() {
            return this.$roughConfig;
        }
        /**
         * Creates a new instance of Svg2roughjs.
         * @param target Either a container `HTMLDivElement` (or a selector for the container) to which a sketch should be added
         * or an `HTMLCanvasElement` or `SVGSVGElement` that should be used as output target.
         * @param outputType Whether the output should be an SVG or drawn to an HTML canvas.
         * Defaults to SVG or CANVAS depending if the given target is of type `HTMLCanvasElement` or `SVGSVGElement`,
         * otherwise it defaults to SVG.
         * @param roughConfig Config object that is passed to Rough.js and considered during
         * rendering of the `SVGElement`s.
         */
        constructor(target, outputType = exports.OutputType.SVG, roughConfig = {}) {
            /**
             * Optional solid background color with which the canvas should be initialized.
             * It is drawn on a transparent canvas by default.
             */
            this.backgroundColor = null;
            /**
             * Set a font-family for the rendering of text elements.
             * If set to `null`, then the font-family of the SVGTextElement is used.
             * By default, 'Comic Sans MS, cursive' is used.
             */
            this.fontFamily = 'Comic Sans MS, cursive';
            /**
             * Whether to randomize Rough.js' fillWeight, hachureAngle and hachureGap.
             * Also randomizes the disableMultiStroke option of Rough.js.
             * The randomness may be seeded with the `seed` property.
             * By default `true`.
             */
            this.randomize = true;
            /**
             * Optional seed for the randomness when creating the sketch.
             * Providing a value implicitly seeds Rough.js which may be overwritten
             * by provding a different seed with the optional `roughConfig` property.
             * By default `null`.
             */
            this.seed = null;
            /**
             * Whether pattern elements should be sketched or just copied to the output.
             * For smaller pattern base sizes, it's often beneficial to just copy it over
             * as the sketch will be too smalle to actually look sketched at all.
             */
            this.sketchPatterns = true;
            /**
             * Whether to apply a pencil filter.
             */
            this.pencilFilter = false;
            this.width = 0;
            this.height = 0;
            this.$roughConfig = {};
            this.idElements = {};
            this.lastResult = null;
            if (!target) {
                throw new Error('No target provided');
            }
            const targetElement = typeof target === 'string' ? document.querySelector(target) : target;
            if (!targetElement) {
                throw new Error('Could not find target in document');
            }
            this.roughConfig = roughConfig;
            this.outputElement = targetElement;
            if (targetElement instanceof HTMLCanvasElement) {
                this.$outputType = exports.OutputType.CANVAS;
            }
            else if (targetElement instanceof SVGSVGElement) {
                this.$outputType = exports.OutputType.SVG;
            }
            else {
                this.$outputType = outputType;
            }
        }
        /**
         * Triggers an entire redraw of the SVG which
         * processes the input element anew.
         * @param sourceSvgChanged When `true`, the given {@link svg} is re-evaluated as if it was set anew.
         *  This allows the Svg2Rough.js instance to be used mutliple times with the same source SVG container but different contents.
         * @returns A promise that resolves with the sketched output element or null if no {@link svg} is set.
         */
        sketch(sourceSvgChanged = false) {
            var _a, _b;
            if (!this.svg) {
                return Promise.resolve(null);
            }
            if (sourceSvgChanged) {
                this.sourceSvgChanged();
            }
            const sketchContainer = this.prepareRenderContainer();
            const renderContext = this.createRenderContext(sketchContainer);
            // prepare filter effects
            if (this.pencilFilter) {
                const defs = getDefsElement(renderContext);
                defs.appendChild(createPencilFilter());
            }
            // sketchify the SVG
            renderContext.processElement(renderContext, this.svg, null, this.width, this.height);
            if (this.outputElement instanceof SVGSVGElement) {
                // sketch already in the outputElement
                return Promise.resolve(this.outputElement);
            }
            else if (this.outputElement instanceof HTMLCanvasElement) {
                return this.drawToCanvas(renderContext, this.outputElement);
            }
            // remove the previous attached result
            (_b = (_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.parentNode) === null || _b === void 0 ? void 0 : _b.removeChild(this.lastResult);
            // assume that the given output element is a container, thus append the sketch to it
            if (this.outputType === exports.OutputType.SVG) {
                const svgSketch = renderContext.svgSketch;
                this.outputElement.appendChild(svgSketch);
                this.lastResult = svgSketch;
                return Promise.resolve(svgSketch);
            }
            else {
                // canvas output type
                const canvas = document.createElement('canvas');
                this.outputElement.appendChild(canvas);
                this.lastResult = canvas;
                return this.drawToCanvas(renderContext, canvas);
            }
        }
        /**
         * Creates a new context which contains the current state of the
         * Svg2Roughs instance for rendering.
         */
        createRenderContext(sketchContainer) {
            if (!this.svg) {
                throw new Error('No source SVG set yet.');
            }
            let roughConfig = this.roughConfig;
            if (this.seed !== null) {
                roughConfig = Object.assign({ seed: this.seed }, roughConfig);
            }
            return {
                rc: rough.svg(sketchContainer, { options: roughConfig }),
                roughConfig: this.roughConfig,
                fontFamily: this.fontFamily,
                pencilFilter: this.pencilFilter,
                randomize: this.randomize,
                rng: new RandomNumberGenerator(this.seed),
                sketchPatterns: this.sketchPatterns,
                idElements: this.idElements,
                sourceSvg: this.svg,
                svgSketch: sketchContainer,
                svgSketchIsInDOM: document.body.contains(sketchContainer),
                styleSheets: Array.from(this.svg.querySelectorAll('style'))
                    .map(s => s.sheet)
                    .filter(s => s !== null),
                processElement: processRoot
            };
        }
        /**
         * Helper method to draw the sketched SVG to a HTMLCanvasElement.
         */
        drawToCanvas(renderContext, canvas) {
            canvas.width = this.width;
            canvas.height = this.height;
            const canvasCtx = canvas.getContext('2d');
            canvasCtx.clearRect(0, 0, this.width, this.height);
            return new Promise(resolve => {
                const svgString = new XMLSerializer().serializeToString(renderContext.svgSketch);
                const img = new Image();
                img.onload = function () {
                    canvasCtx.drawImage(this, 0, 0);
                    resolve(canvas);
                };
                img.src = `data:image/svg+xml;charset=utf8,${encodeURIComponent(svgString)}`;
            });
        }
        /**
         * Prepares the given SVG element depending on the set properties.
         */
        prepareRenderContainer() {
            let svgElement;
            if (this.outputElement instanceof SVGSVGElement) {
                // just use the user given outputElement directly as sketch-container
                svgElement = this.outputElement;
            }
            else {
                // we need a separate svgElement as output element
                svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            }
            // make sure it has all the proper namespaces
            svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgElement.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
            // clear SVG element
            while (svgElement.firstChild) {
                svgElement.removeChild(svgElement.firstChild);
            }
            // set size
            svgElement.setAttribute('width', this.width.toString());
            svgElement.setAttribute('height', this.height.toString());
            // apply backgroundColor
            let backgroundElement;
            if (this.backgroundColor) {
                backgroundElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                backgroundElement.width.baseVal.value = this.width;
                backgroundElement.height.baseVal.value = this.height;
                backgroundElement.setAttribute('fill', this.backgroundColor);
                svgElement.appendChild(backgroundElement);
            }
            // use round linecap to emphasize a ballpoint pen like drawing
            svgElement.setAttribute('stroke-linecap', 'round');
            return svgElement;
        }
        /**
         * Initializes the size based on the currently set SVG and collects elements
         * with an ID property that may be referenced in the SVG.
         */
        sourceSvgChanged() {
            const svg = this.$svg;
            if (svg) {
                const precision = this.roughConfig.fixedDecimalPlaceDigits;
                this.width = parseFloat(this.coerceSize(svg, 'width', 300).toFixed(precision));
                this.height = parseFloat(this.coerceSize(svg, 'height', 150).toFixed(precision));
                // pre-process defs for subsequent references
                this.collectElementsWithID();
            }
        }
        /**
         * Stores elements with IDs for later use.
         */
        collectElementsWithID() {
            this.idElements = {};
            const elementsWithID = Array.prototype.slice.apply(this.svg.querySelectorAll('*[id]'));
            for (const elt of elementsWithID) {
                const id = elt.getAttribute('id');
                if (id) {
                    this.idElements[id] = elt;
                }
            }
        }
        /**
         * Helper to handle percentage values for width / height of the input SVG.
         */
        coerceSize(svg, property, fallback) {
            let size = fallback;
            const hasViewbox = svg.hasAttribute('viewBox');
            if (svg.hasAttribute(property)) {
                // percentage sizes for the root SVG are unclear, thus use viewBox if available
                if (svg[property].baseVal.unitType === SVGLength.SVG_LENGTHTYPE_PERCENTAGE && hasViewbox) {
                    size = svg.viewBox.baseVal[property];
                }
                else {
                    size = svg[property].baseVal.value;
                }
            }
            else if (hasViewbox) {
                size = svg.viewBox.baseVal[property];
            }
            return size;
        }
    }

    exports.Svg2Roughjs = Svg2Roughjs;

}));
//# sourceMappingURL=svg2roughjs.umd.js.map
