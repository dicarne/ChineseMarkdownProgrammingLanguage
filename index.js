const fs = require("fs")
const { env } = require("process");

let content = fs.readFileSync("D://CN//text.md").toString();
content = content.replace(/\r\n/g, "\n");
function analyse(content) {

    let no_comment = content
        .split("\n")
        .filter(v => v !== "" && !v.startsWith("> "))
        .join("\n")

    Array.prototype.division = function (pre, output) {
        let res = []
        for (let i = 0; i < this.length; i++) {
            const e = this[i];
            if (pre(e)) res.push(e)
            else output.push(e)
        }
        return res
    }
    let others = []
    let imports =
        no_comment.split(/(从“\S+”引入\S+。)/g)
            .division(v => /从“\S+”引入\S+。/g.test(v), others)
            .map(v => {
                let res = /从“(?<lib>\S+)”引入(?<pkgs>\S+)。/g.exec(v)
                return {
                    lib: res.groups["lib"],
                    pkg: res.groups["pkgs"].split(/[，。]/g)
                }
            })

    let no_nps = []
    let sa = others.join("")
        .split(/^(#{1}\s\S+\n)/g)
    let namespaces = sa
        .division(v => /(^#{1}\s\S+\n)/g.test(v), no_nps)
        .map(v => /#\s(?<name>\S+)\s?\n?/g.exec(v).groups["name"])

    let scope_def = (" " + no_nps.join("")
    ).split(/[^#](#{2}\s\S+)\n/)

    function createScope(title) {
        return {
            title: title,
            content: []
        }
    }

    let currentScop = createScope("");
    let scopes = []
    for (let i = 0; i < scope_def.length; i++) {
        const e = scope_def[i];
        if (/^(##\s\S+)/g.test(e)) {
            if (currentScop.title !== "")
                scopes.push(currentScop);
            currentScop = createScope(e);
        } else {
            currentScop.content.push(e);
        }
    }
    if (currentScop.title !== "")
        scopes.push(currentScop);

    scopes.env = createNewEnv()

    for (let i = 0; i < scopes.length; i++) {
        const scop = scopes[i];
        scop.env = createNewEnv(scopes.env)
        if (/^##\s方法：/g.test(scop.title)) {
            let fuc = /^##\s方法：(?<func>.+)/g.exec(scop.title)
            let spfunc = fuc.groups["func"].split(/(【[^】]+】)/g)
            scop.type = "function"
            scop.param = spfunc.map(v => {
                if (!v.startsWith("【")) {
                    return { text: v, type: "label" }
                } else {
                    let vname = /【(?<pname>\S+)】/g.exec(v).groups["pname"]
                    scop.env.variable[vname] = { value: null }
                    return { text: vname, type: "variable" }
                }
            })
            scop.env.exec = analyse_statements(scop.env, scop.content.join(""))
        } else if (/^##\s运行/g.test(scop.title)) {
            scop.type = "run"
            scop.env.exec = analyse_statements(scop.env, scop.content.join(""))
        }
    }
    return scopes
}

function createNewEnv(parent) {
    return {
        parent,
        variable: {},
        methods: {},
        exec: []
    }
}

function createNewCommends() {
    return {
        type: "UNKNOW"
    }
}

function createNewAssign(target, source) {
    let cmd = createNewCommends()
    return {
        ...cmd, target, source, type: "ASSIGN"
    }
}

function createNewIfOneLine(ifexpr) {
    let cmd = createNewCommends()
    return {
        ...cmd, ifexpr, type: "IF_ONE_LINE"
    }
}

function createNewIf(ifexpr, thendo, elsedo) {
    let cmd = createNewCommends()
    return {
        ...cmd, ifexpr, thendo, elsedo, type: "IF"
    }
}

function createNewThenOneLine(then_exec_env) {
    let cmd = createNewCommends()
    return {
        ...cmd, exec_env: then_exec_env, type: "THEN_ONE_LINE"
    }
}
function createNewElseOneLine(then_exec_env) {
    let cmd = createNewCommends()
    return {
        ...cmd, exec_env: then_exec_env, type: "ELSE_ONE_LINE"
    }
}

function createMiniScope(env) {
    let cmd = createNewCommends()
    return {
        ...cmd, exec_env: env, type: "MINI_SCOPE"
    }
}

function createNewAssignReturn(expr) {
    let cmd = createNewCommends()
    return {
        ...cmd, expr, type: "ASSIGN_RETURN"
    }
}

function createNewOutput(expr) {
    let cmd = createNewCommends()
    return {
        ...cmd, expr, type: "OUTPUT"
    }
}

function createNewRangeLoop(from, to, index, exec_env) {
    let cmd = createNewCommends()
    return {
        ...cmd, from, to, index, exec_env, type: "RANGE_LOOP"
    }
}
function createNewOneLineRangeLoop(from, to, index, exec_env) {
    let cmd = createNewCommends()
    return {
        ...cmd, from, to, index, exec_env, type: "RANGE_LOOP_ONELINE"
    }
}

function createNewFunctionCall(content) {
    let cmd = createNewCommends()
    return {
        ...cmd, call_content: content, type: "FUNC_CALL"
    }
}

function createNewFuncReturn() {
    let cmd = createNewCommends()
    return {
        ...cmd, type: "FUNC_RETURN"
    }
}


function analyse_statements(env, body_content) {
    let commands = []
    let split_with_sub_scope =
        body_content.split(/([^\n]+：\n(?:(?:否则(?:若\S*)?：\n)*(?:\s*\*\s.+\n)+)*(?:\S*\s*)结束。)/g).filter(v => v !== "" && v !== "\n")

    for (let i = 0; i < split_with_sub_scope.length; i++) {
        const statement = split_with_sub_scope[i];
        if (/([^\n]+：\n(?:(?:否则(?:若\S*)?：\n)*(?:\s*\*\s.+\n)+)*(?:\S*\s*)结束。)/g.test(statement)) {
            // 进入子组
            let senv = createNewEnv(env)
            let head_tail = statement.split(/(：)/);
            // TODO: 分析匹配前部分是什么，并为局部变量赋值
            let ss = head_tail.filter((v, i) => i > 1).join("").split(/(结束。)/).filter(v => v !== "" && v !== "\n")
            ss = ss.filter((v, i) => i !== ss.length - 1).join("")//.split("* ").join("")


            let stop = false
            // 判断循环
            let loop_p = /从(?<from>\S+)到(?<to>\S+)的每个(?<index>\S+)/
            if (!stop && loop_p.test(head_tail[0])) {
                let sub_commands = analyse_statements(senv, ss)
                senv.exec = sub_commands
                let rangeloop = loop_p.exec(head_tail[0])
                commands.push(createNewRangeLoop(rangeloop.groups["from"]
                    , rangeloop.groups["to"], rangeloop.groups["index"], senv))
                stop = true
            }
            let h0 = head_tail[0]
            //判断if
            let if_p = /若(?<expr>.+)/
            if (!stop && if_p.test(h0)) {
                let exp = if_p.exec(h0).groups["expr"]
                let oth = head_tail.filter((v, id) => id > 1)
                    .join("")
                    .split(/(结束。)/)
                    .filter(v => v !== "" && v !== "\n")
                    //oth = oth.filter((v, id) => id < oth.length - 1)
                    .join("")
                    .split(/(否则)/)
                for (let j = 0; j < oth.length; j++) {
                    const e = oth[j];
                    if (e === "否则") {
                        let thendo = createNewEnv(env)
                        thendo.exec = analyse_statements(thendo, oth.filter((v, id) => id < j).join(""))
                        let elsedo = createNewEnv(env)
                        elsedo.exec = analyse_statements(elsedo, oth.filter((v, id) => id > j).join(""))
                        commands.push(createNewIf(exp, thendo, elsedo))
                        break;
                    }
                }
            }
        } else {
            // 在本空间内
            if (/。/g.test(statement)) {
                let sub = statement.split(/[。\n]/).filter(v => v !== "\n" && v !== "")
                for (let j = 0; j < sub.length; j++) {
                    const onestate = sub[j];
                    if (!/，/.test(onestate)) {
                        let sub_cmds = analyseOneState(env, onestate)
                        commands = [...commands, ...sub_cmds]
                    } else {
                        let senv = createNewEnv(env)
                        let cen = onestate.split("，")
                        let firstIsMain = false;
                        let main
                        if (/：/.test(cen[0])) {
                            let sp = cen[0].split("：");
                            main = sp[0]
                            cen[0] = sp[1]
                            firstIsMain = true
                        }
                        if (firstIsMain) {
                            if (/从(?<from>\S+)到(?<to>\S+)的每个(?<index>\S+)/.test(main)) {
                                let getg = /从(?<from>\S+)到(?<to>\S+)的每个(?<index>\S+)/.exec(main)
                                let nenv = createNewEnv(env)
                                let ifexpr = false
                                for (let p = 0; p < cen.length; p++) {
                                    const one = cen[p];
                                    let sc = analyseOneState(nenv, one)
                                    if (/^否则/.test(one)) {
                                        ifexpr = true
                                    }
                                    sc.forEach(v => v.if_assert_false = ifexpr)
                                    nenv.exec = [...nenv.exec, ...sc]
                                }
                                commands.push(
                                    createNewRangeLoop(getg.groups["from"],
                                        getg.groups["to"],
                                        getg.groups["index"], nenv))

                            }
                        } else {
                            let ifexpr = false
                            for (let p = 0; p < cen.length; p++) {
                                const one = cen[p].split(" ").join("").split("*").join("");
                                let sc = analyseOneState(senv, one)
                                if (/^否则/.test(one)) {
                                    ifexpr = true
                                }
                                sc.forEach(v => v.if_assert_false = ifexpr)
                                senv.exec = [...senv.exec, ...sc]
                            }
                            commands.push(createMiniScope(senv))
                        }

                    }
                }
            }
        }
    }

    return commands;
}

function analyseOneState(env, content) {
    let cmd = []
    if (/令(?<front>[\S]+)为(?<end>[\S]+)/.test(content)) {
        let ass = /令(?<front>[\S]+)为(?<end>[\S]+)/.exec(content)
        env.variable[ass.groups['front']] = { value: null }
        cmd.push(createNewAssign(ass.groups['front'], ass.groups['end']))
    } else if (/^若/.test(content)) {
        let ifp = /若(?<expr>.+)/.exec(content)
        cmd.push(createNewIfOneLine(ifp.groups["expr"]))
    } else if (/^否则/.test(content)) {
        let ifp = /否则(?<expr>.+)/.exec(content)
        let senv = createNewEnv(env)
        senv.exec = analyseOneState(senv, ifp.groups["expr"])
        cmd.push(createNewElseOneLine(senv))
    } else if (/^则/.test(content)) {
        let ifp = /则(?<expr>.+)/.exec(content)
        let senv = createNewEnv(env)
        senv.exec = analyseOneState(senv, ifp.groups["expr"])
        cmd.push(createNewThenOneLine(senv))
    } else if (/确定为/.test(content)) {
        let ret = /确定为(?<retexp>\S+)/.exec(content)
        cmd.push(createNewAssignReturn(ret.groups['retexp']))
    } else if (/终止/.test(content)) {
        cmd.push(createNewFuncReturn())
    } else if (/输出/.test(content)) {
        let outp = /输出(?<oup>.+)/.exec(content)
        cmd.push(createNewOutput(outp.groups['oup']))
    }
    else if (content === "结束" || content === "：") { } else if (content !== "" && content !== "\n" && content !== " ") {
        let clean = content.split("*").join("").split(" ").join("").split("\n").join()
        if (clean !== " ")
            cmd.push(createNewFunctionCall(clean))
    }

    return cmd
}

let scopes = analyse(content)
inject(scopes)

runcode(scopes)
function runcode(scopes) {
    let mainf = scopes.findIndex(v => v.type === "run")
    let functionmap = scopes.filter(v => v.type === "function" || v.type === "BUILT_IN")
    for (let i = 0; i < scopes.default_value.length; i++) {
        const v = scopes.default_value[i];
        scopes[mainf].env.variable[v.name] = v.value
    }
    for (let i = 0; i < functionmap.length; i++) {
        const defs = functionmap[i];
        let pstr = "^"
        for (let j = 0; j < defs.param.length; j++) {
            const p = defs.param[j];
            if (p.type === "variable") {
                pstr += "(\\S*)"
            } else if (p.type === "label") {
                pstr += p.text
            }
            if (j === defs.param.length - 1) {
                pstr += "$"
            }
        }
        defs.reg = pstr
    }
    scopes[mainf].env.deep = 0
    runcommands(scopes[mainf].env, { methods: functionmap, returnFunc: false })
}

function runcommands(commands, scopes) {
    commands.deep += 1;
    commands.ifexpr = true
    let q = commands.exec
    for (let i = 0; i < q.length; i++) {
        const current = q[i];
        switch (current.type) {
            case "MINI_SCOPE":
                setReturn(commands, runcommands(
                    linkParent(cloneEnv(current.exec_env, commands.deep), commands), scopes))
                break;
            case "ASSIGN":
                if (commands.ifexpr && !current.if_assert_false) {
                    let varia = findVariable(commands, scopes, current.source)
                    if (!varia) varia = FunctionCall(commands, scopes, current.source)
                    commands.variable[current.target] = varia
                }
                break;
            case "FUNC_CALL":
                if (commands.ifexpr && !current.if_assert_false) {
                    let call = current.call_content
                    let res = FunctionCall(commands, scopes, call)
                    commands.variable["它"] = res
                }

                break;
            case "IF_ONE_LINE":
                let ifexp = current.ifexpr
                let res2 = findVariable(commands, scopes, ifexp)
                // TODO:
                commands.ifexpr = !!(res2 && res2.value);
                break;
            case "IF":
                let r = findVariable(commands, scopes, current.ifexpr)
                if (r && r.value) {
                    setReturn(commands, runcommands(
                        linkParent(cloneEnv(current.thendo, commands.deep),
                            commands), scopes));
                } else {
                    setReturn(commands, runcommands(
                        linkParent(cloneEnv(current.elsedo, commands.deep),
                            commands), scopes));
                }
                break;
            case "THEN_ONE_LINE":
                if (commands.ifexpr && !current.if_assert_false) {
                    setReturn(commands, runcommands(
                        linkParent(cloneEnv(current.exec_env, commands.deep), commands), scopes));
                }
                break;
            case "ELSE_ONE_LINE": {
                if (!commands.ifexpr && current.if_assert_false) {
                    setReturn(commands, runcommands(
                        linkParent(cloneEnv(current.exec_env, commands.deep), commands), scopes)
                    )
                }
                break;
            }
            case "OUTPUT":
                if (commands.ifexpr && !current.if_assert_false)
                    console.log(/“(?<message>.*)”/.exec(current.expr)?.groups["message"] || findVariable(commands, scopes, current.expr)?.value)
                break;
            case "ASSIGN_RETURN":
                if (commands.ifexpr && !current.if_assert_false) {
                    let expr = current.expr
                    if (!commands.variable["确定"])
                        commands.variable["确定"] = findVariable(commands, scopes, expr)
                }
                break;
            case "RANGE_LOOP":
                if (commands.ifexpr && !current.if_assert_false) {
                    let from = current.from
                    let to = current.to
                    let fromI = Number(from)
                    let toI = Number(to)
                    if (isNaN(fromI)) {
                        fromI = findVariable(commands, scopes, from).value
                    }
                    if (isNaN(toI)) {
                        toI = findVariable(commands, scopes, to).value
                    }
                    let index = current.index
                    let body = linkParent(cloneEnv(current.exec_env, commands.deep), commands)
                    for (let ii = fromI; ii <= toI; ii++) {
                        body.variable[index] = { value: ii, type: "INT" }
                        body.variable["它"] = { value: ii, type: "INT" }
                        setReturn(commands, runcommands(body, scopes))
                        if (scopes.returnFunc) break;
                    }
                }
                break;
            case "FUNC_RETURN":
                if (commands.ifexpr && !current.if_assert_false) {
                    scopes.returnFunc = true
                    return commands.variable["确定"];
                }

            default:
                break;
        }
        if (scopes.returnFunc) {
            if (commands.deep === 1) {
                scopes.returnFunc = false
            }
            return commands.variable["确定"];
        }
    }
    return commands.variable["确定"];
}

function setReturn(env, value) {
    if (!env.variable["确定"]) {
        env.variable['确定'] = value
    }
}

function findVariable(env, scopes, name) {
    let fromI = Number(name)
    if (!isNaN(fromI)) return { value: fromI, type: "NUMBER" }
    let vari = _findVariable(env, scopes, name)
    if (vari) return vari
    return FunctionCall(env, scopes, name)
}


function _findVariable(env, scopes, name) {
    let localfind = env.variable[name]
    if (localfind !== undefined) return localfind
    if (env.parent) {
        let lookparent = _findVariable(env.parent, scopes, name)
        return lookparent
    }
}

function FunctionCall(env, scopes, callContent) {
    for (let i = 0; i < scopes.methods.length; i++) {
        const defs = scopes.methods[i];

        let pp = new RegExp(defs.reg)
        if (pp.test(callContent)) {
            let newenv = linkParent(cloneEnv(defs.env, 0), env)
            let result = callContent.split(pp)
            let params = result.filter(v => v !== "")
            let _index = 0
            for (let j = 0; j < defs.param.length; j++) {
                const e = defs.param[j];
                if (e.type === "variable") {
                    newenv.variable[e.text] = findVariable(env, scopes, params[_index])
                    _index++
                }
            }
            newenv.deep = 0
            if (defs.type === "BUILT_IN") {
                switch (defs.bind) {
                    case "sqrt":
                        return { value: Math.sqrt(newenv.variable["输入"].value) }
                    case "%":
                        return {
                            value: Math.floor(newenv.variable["数1"].value)
                                % Math.floor(newenv.variable["数2"].value)
                        }
                    case "==":
                        return {
                            value: newenv.variable["数1"].value
                                === newenv.variable["数2"].value
                        }
                    case "==true":
                        let vt = newenv.variable["数1"].value
                        return {
                            value:
                                vt === true || vt === "是"
                        }
                    case "==false":
                        let vf = newenv.variable["数1"].value
                        return {
                            value:
                                vf === false || vf === "否"
                        }
                    default:
                        break;
                }
            }
            else {
                return runcommands(newenv, scopes)
            }
            return newenv.variable["确定"]
        }
    }
}

function cloneEnv(env, deep) {
    return {
        variable: {},
        exec: env.exec,
        deep: deep,
        parent: env.parent
    }
}
function linkParent(env, parent) {
    env.parent = parent
    return env
}

function inject(scopes) {
    scopes.push({
        param: [
            { text: "根号", type: "label" },
            { text: "输入", type: "variable" }
        ], env: {
            variable: {},
            exec: {}
        },
        type: "BUILT_IN",
        bind: "sqrt"
    })
    scopes.push({
        param: [
            { text: "数1", type: "variable" },
            { text: "%", type: "label" },
            { text: "数2", type: "variable" }
        ], env: {
            variable: {},
            exec: {}
        },
        type: "BUILT_IN",
        bind: "%"
    })
    scopes.push({
        param: [
            { text: "数1", type: "variable" },
            { text: "等于", type: "label" },
            { text: "数2", type: "variable" }
        ], env: {
            variable: {},
            exec: {}
        },
        type: "BUILT_IN",
        bind: "=="
    })

    scopes.push({
        param: [
            { text: "数1", type: "variable" },
            { text: "不是", type: "label" },
        ], env: {
            variable: {},
            exec: {}
        },
        type: "BUILT_IN",
        bind: "==false"
    })
    scopes.push({
        param: [
            { text: "数1", type: "variable" },
            { text: "是", type: "label" },
        ], env: {
            variable: {},
            exec: {}
        },
        type: "BUILT_IN",
        bind: "==true"
    })
    scopes.default_value = [
        { name: "是", value: { value: true, type: "BOOL" } },
        { name: "否", value: { value: false, type: "BOOL" } }]

}