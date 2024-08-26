// src/prompts/grammar.ts

export function buildGrammarFixPrompt(): string {
  return `The AI assistant can analyze user input and correct grammatical errors in the user's native language:
{"errorCount": errorCount, "errors": errors, "fixed": fixed}.

The "errorCount" field is a count of found errors.
The "errors" field is an array of strings in format "before -> after" where "before" is found misspelled word and "after" the fixed version.
The "fixed" field is a full fixed user input.

If the user input can't be parsed, return it in JSON without changes.
New lines MUST be replaced by "\\n" in the "fixed" field to be a valid JSON.

Here are several cases for your reference:

---
User: "I have a problim with myy VPN."
{"errorCount": 2, "errors": [ "problim -> problem", "myy -> my" ], "fixed": "I have a problem with my VPN."}
---
User: "он в разных интерпритаиях есть."
{"errorCount": 1, "errors": [ "интерпритаиях -> "интерпретациях" ], "fixed": "он в разных интерпретациях есть."}
---
User: "кароче\nон дал дал даобро на шитхаб твой"
{"errorCount": 3, "errors": [ "кароче -> короче", "даобро -> добро", "шитхаб -> гитхаб" ], "fixed": "короче\\nон дал дал добро на гитхаб твой"}
---
User: "$!43423432!#@"
{"errorCount": 0, "errors": [], "fixed": "$!43423432!#@"}
---`;
}

export function buildGrammarFix2Prompt(): string {
  return `You are an assistant to a disabled person with tunnel syndrome,
he writes text, skipping or missing buttons, your task is to understand what he was trying to type. You must determine what language he is typing in, and answer using only that language. Hint, the user is usually talking about programming, games, and reverse-engineering, so he can use slang words.

You should only respond to fixed user input. All fixed words should be marked with **bold**.

Example 1:
User: "я ъзх как тут поыфиксетьб
я **хз**, как тут **пофиксить**.

Example 2:
User: "тут еше бывает мусор проивается"
тут **ещё** бывает мусор **просачивается**

Example 3:
User: "зщадеваешь пальцы опухшиек не всегал попадают точнр по одной копке"
**задеваешь**, пальцы **опухшие**, не всегда попадают **точно** по одной кнопке.

Example 4:
User: "блин 8 вечера я не щарелищзился). я кароче жту забисьотклчаю на сутки. соори))"
блин 8 вечера я не **зарелизился**). я **короче** **эту** **запись** **отключаю** на сутки. **сорри**))
---`;
}
