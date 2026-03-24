---
title: Comparison of Packaging Tools in 2023
titleTemplate: '[PyCon APAC 2023] %s'
lineNumbers: true
theme: ../../themes/watercolors
presenter: dev
aspectRatio: 16/9
favicon: https://peacock0803sz.com/favicon.ico
layout: cover
---

# Comparison of <br> Packaging Tools in 2023

## Peacock (Yoichi Takai), <br> at PyCon APAC 2023 (2023/10/28)

<!--
..., thank you introduce!
-->

---
layout: intro
---

<div class="head">

Slides: [slides.p3ac0ck.net/pyconapac2023/index.html](https://slides.p3ac0ck.net/pyconapac2023/index.html)

</div>

<div class="box">
<div class="inner">

Feel Free to Take Pictures <twemoji-camera />

Social Hashtags:

- `#pyconapac_2`
- `#pyconapac2023`

</div>

<img src="/images/qrcode.svg" />
</div>

<!--
Slides are uploaded, so you can see them via the URL or QR code.  
And, feel free to take pictures and share them on social media.  
If you have any questions, please ask me on open space after this talk.
-->

---
layout: section
---

# Introduction

## Backgrounds, Motivations, Target Audiences

<!--
First of all, I'll explain why I made this talk, and who is target audience.
-->

---

# Backgrounds and Motivations

- Situation of Python packaging was changed dramatically - Adopted 3 PEPs;
    - [PEP 517](https://peps.python.org/pep-0517/): build system specification format
    - [PEP 621](https://peps.python.org/pep-0621/): **Standardized `pyproject.toml` format**
    - [PEP 660](https://peps.python.org/pep-0660/): `pyproject.toml` based editable installs

<!--
At first, my motivation for this talk is here...  
There are so many packaging tools in Python, but those are different in designs/objectives...  
So If you are not professional for python packaging, It's very hard to choose the best one for your project.

Over the last few years, around these tools have changed dramatically, because of the adoption and increase of supporting several big PEPs specifications.  
There are three PEPs have been particularly influential;  
first, 517(**five-hundred seventeen**), build system specification format,  
second, 621(**six-hundred twenty-one**), Standardized `pyproject.toml` format,  
and finally, 660(**six-hundred sixty**), pyproject.toml based editable installs.
-->

---
layout: statement
---

## I felt...

# Needed a **Pros-Cons comparison** in now?

<!--
I often see and am asked the question, **"Which packaging tool should I use?"** in the Python community or elsewhere.  
So, I felt needed a Pros-Cons based comparison in 2023,  

Please note that all opinions are my own, since I'm a not developer of any packaging tools.
-->

---
layout: statement
---

# Target Audiences of this Talk

## Struggling with choosing packaging tools:

- for 3 types of Pythonistas:
    - Library / Framework Developer (Complex Project)
    - Application Developer (Many People Project)
    - Single or Few Files Scripts Developer (Small Project)

<!--
Okay, I'll compare these tools for 3 types of Pythonistas

First, Library (or Framework) Developer to complex project structures.  
Second is Application Developer, who is developing a large project or many people different skills are involved in the project.  
And finally is One-shot or Scripting Developer, who is limited scopes or small projects.
-->

---
layout: toc
---

# Table of Contents

<ol>
  <li>Introduction
    <ol>
      <li class="gray">Background, Motivations, Target Audiences of this Talk</li>
      <li>List of Packaging tools to compare in this Talk</li>
      <li>Self-Introduction</li>
    </ol>
  </li>
  <li>Pros / Cons for each tool
    <ol>
      <li><a href="https://Pipenv.pypa.io/en/latest/">Pipenv</a>, <a href="https://python-poetry.org">Poetry</a>, <a href="https://pdm.fming.dev/latest/">PDM</a>, <a href="https://pip-tools.readthedocs.io/en/latest/">pip-tools</a>, <a href="https://hatch.pypa.io/latest/">Hatch</a>, <a href="https://pip.pypa.io/en/stable/index.html">pip (with venv)</a></li>
    </ol>
  </li>
  <li>What is the best tool? (for Library / Application / Scripting Developers)</li>
  <li>Appendix: <a href="https://rye-up.com">Rye</a></li>
</ol>

<!--
This is today's agenda.  
I'll tell you the pros/cons of each tool. and finally, introduce the best tool and why for 3 types of Pythonistas.

and then, If you might be watching, I'll introduce Rye as an appendix.
-->

---
layout: table
---

# Basic Information

| Name                                                     | Author            | First Release                 | License      |
| -------------------------------------------------------- | ----------------- | ----------------------------- | ------------ |
| [Pipenv](https://pipenv.pypa.io/en/latest/)              | Kenneth Reitz     | 2018/06 `2018.6.25`           | MIT          |
| [Poetry](https://python-poetry.org)                      | Sébastien Eustace | 2018/03 `0.2.0`               | MIT          |
| [PDM](https://pdm.fming.dev/latest/)                     | Frost Ming        | 2020/01 `0.0.1`               | MIT          |
| [pip-tools](https://pip-tools.readthedocs.io/en/latest/) | Vincent Driessen  | 2017/04 `1.8.2`               | BSD 3-Clause |
| [Hatch](https://hatch.pypa.io/latest/)                   | Ofek Lev          | 2021/12 `Hatch v1rc2`         | MIT          |
| [pip](https://pip.pypa.io/en/stable/index.html)          | PyPA              | 2008/12 (First GitHub commit) | MIT          |

<!--
These are the tools I'll compare today.  
There are 6 tools, Pipenv, Poetry, PDM, pip-tools, Hatch, and pip.  
Few tools that I do not mention today, but I think I have covered the most well-known or useful ones.
-->

---
layout: profile
---

# Self-Introduction

<div class="box">
<div class="inner">

- Name: Peacock / Yoichi Takai
- Social media names: `peacock0803sz`
- 23 Years Old, 5+ Years of Python Ex
- Work: [TOPGATE, Inc.](https://topgate.co.jp) (2022/12 ~)
- Vice-Chair of [PyCon APAC 2023](https://2023-apac.pycon.jp)
- Likes: Listening to Music <twemoji-musical-note /> / Cameras <twemoji-camera /> / Audios <twemoji-studio-microphone /> / Drinking <twemoji-clinking-beer-mugs />

</div>
<img src="https://avatars.githubusercontent.com/u/33555487?v=4" />
</div>

<!--
Let me introduce myself briefly. I'm Yoichi Takai as known as Peacock, so please call me Peacock.  
Since December 2022, I've been working at TOPGATE, Inc. as an IaC / DevOps engineer.

While my working, I've been a volunteer staff of PyCon JP since 2020(twenty-twenty) and Vice-Chair since last year.  
In addition, I'm a director of PyCon JP TV as an Operating member of the PyCon JP Association, for a YouTube Live director held a once per month.

My hobbies are listening to music, gadgets, skiing, eating and drinking.  
And then, this is my first talk opportunity in PyCon held in Japan, so I feel very honored.
-->

---
layout: section
---

# Pre-explain

## About [PEP 621](https://peps.python.org/pep-0621/) style `pyproject.toml`

<!--
Before starting to compare tools, I'd like to explain about the most important PEP I think, six-hundred twenty-one was what defined `pyproject.toml`.
-->

---

# PEP 621 style `pyproject.toml`

ref: <https://peps.python.org/pep-0621/>

```toml {|1-2|11|13-14}
[build-system]
requires = ["setuptools>=45","wheel"]

[project]
name = "my-awesome-package"
readme = "README.md"
license = {file = "LICENSE"}
authors = [{name = "Peacock", email = "peacock@example.com"}]
version = "0.1.0"
requires-python = ">=3.10"
dependencies = ["SQLAlchemy", "FastAPI"] # list dependencies here

[project.optional-dependencies]
dev = ["black", "flake8", "mypy"] # list dev-dependencies here
```

<!--
It's the new standard for defining Python package meta-data and build-time dependencies. There are three points for defining dependencies.

First, the `build-system` table is for defining build-time dependencies.  
Next, the `dependencies` property in the `project` table is for defining dependencies.  
And Lastly, the `project.optional-dependencies` table is for defining optional dependencies.

But please do not think that "requrements.txt is dead?", it's not.  
It's a another dimension and I will not explain in this talk.  
If you are interested in that, let's discuss it in open space after this talk.
-->

---
layout: section
---

# Pros/Cons for each tool

## Main comparison points

<!--
Okay, now let's start the main section of this talk.  
I'll introduce the pros/cons of each tool.
-->

---
layout: section
---

<div class="box">
<div class="inner">

# Pipenv

## <https://pipenv.pypa.io/en/latest/>

</div>
<img src="https://pipenv.pypa.io/en/latest/_static/pipenv.png" />
</div>

<!--
**手短に、たくさん話さない**

First is Pipenv.

It was very popular around 2018, Although its popularity seems to have settled down, it is still maintained.  
Who doesn't know this? It was a game-changer. But I will not explain a lot because I don't recommend it.
-->

---

# Pipenv: Pros

- Supporting lock-file
- Easy to add/upgrade packages
- Wraps virtualenv

# Pipenv: Cons

- Slow dependency resolver (improved?)
- LIMITED support PEP 621 style `pyproject.toml`

<!--
It has been very progressive, because it brought the lock-file to the Python community.  
With `pipenv upgrade` command, you can upgrade dependencies easily.  
And, Wrapping virtualenv was also revolutionary. You can forget to activate and deactivate virtualenv.  

But, **LIMITED support PEP six-hundred twenty-one** style `pyproject.toml`.  
I think it's no longer a good idea to use it for new projects.
-->

---
layout: section
---

<div class="box">
<div class="inner">

# Poetry

## <https://python-poetry.org/>

</div>

<img src="https://python-poetry.org/images/logo-origami.svg" />
</div>

<!--
Next is Poetry.

I remember it becoming famous around 2020, but I think it is still a popular tool.  
How many of you use it for work or other projects? Raise your hand if you use this.
Oh, so many people. I think it's the most popular tool in this talk, but I will not recommend it.
-->

---

# Poetry: Pros

- Dependency management with lock-file
- Wraps virtualenv
- Included Task-runner (`poetry run`)
- Helper for the building wheels

# Poetry: Cons

- NOT support [PEP 621](https://peps.python.org/pep-0621/) style `pyproject.toml`

<!--
Poetry has so many features to I can't explain all of them, but I'll introduce some of mainly.  
Needless to say, it was later than Pipenv, so it supports lock-file and wraps virtualenv.  

And as you may know, the points that Poetry was very revolutionary it included Task-runner and helper for the building wheels. It helps package publishers to build, test and publish packages.

One thing of cons is that it does not support PEP six-hundred twenty-one style `pyproject.toml`.  
Poetry appeared before the accepted PEP six-hundred twenty-one, but discussions are still ongoing.  
Please note that there will be conflicts because there are many dependent packages if you install them in a project with virtualenv.
-->

---
layout: section
---

<div class="box">
<div class="inner">

# PDM

## <https://pdm.fming.dev/latest/>

</div>

<img src="https://pdm.fming.dev/latest/assets/logo.svg" />
</div>

<!--
And third one is PDM.

I did not know this tool until I wrote this talk proposal, but it seems to be a very interesting tool.
-->

---

# PDM: Pros

- Fast dependency resolver
    - But you can choose another resolver
- Support [PEP 621](https://peps.python.org/pep-0621/) style `pyproject.toml`
- Included Task-runner (`pdm run`), package publisher

# PDM: Cons

- Few GitHub Stars / not Famous

<!--
It has two points of advantages.  
The first one is the fast dependency resolver. It is the fastest of the tools I introduce today. But, you can choose the another dependency resolver.  
Next point, it supports PEP six-hundred twenty-one style `pyproject.toml`, The two previous ones had limited or no support, but this one is already supported. So, its format is Standardized by PEP, you may transfer to other tools easily.  
It also includes a task-runner, wheels builder and package publisher.

I think one drawback point is that it is not famous, so there are maybe few users and not enough knowledge.
-->

---
layout: section
---

# pip-tools

## <https://pip-tools.readthedocs.io/en/latest/>

<!--
Fourth, is pip-tools.

Please note that The following tools, pip-tools, hatch, and pip are not all-inclusive, but only those that offer limited functionality.
-->

---

# pip-tools: Pros

- Simple to use, **only 2 commands**
- Support PEP 621 style `pyproject.toml` dependency
    - Combine-able with pip or hatch
- Maintained by the [Jazzband](https://jazzband.co) community

# pipe-tools: Cons

- not Included Task-runner, wheel builder and package publisher

<!--
It's very simple to use, with only 2 commands, `pip-compile` and `pip-sync`, and also supports PEP six-hundred twenty-one style `pyproject.toml` dependency definition.  
One more advantage is that it's maintained by the Jazzband community, and has many Django utilities. I think governance by the community is very important.

But, needless to say, it does not include a task-runner, wheel builder and package publisher.  
So I'll recommend using it with Hatch, next one.
-->

---
layout: section
---

<div class="box">
<div class="inner">

# Hatch

## <https://hatch.pypa.io/latest/>

</div>

<img src="https://hatch.pypa.io/latest/assets/images/logo.svg" />
</div>

<!--
The fifth is Hatch, the last tool I will introduce in this talk other than pip.

It was published very recently and may be of interest to many folks.
-->

---

# Hatch: Pros

- Configurable to a back-end for building project
- Maintained actively by [PyPA](https://www.pypa.io), nearly official
- Works with `pyproject.toml` spec, [PEP 621](https://peps.python.org/pep-0621/) style

# Hatch: Cons

- Not included dependency updater
- Not supporting lock-file

<!--
It's very configurable to a back-end for building projects, you can use it with other tools like pip-tools.  
And, it's maintained actively by PyPA - Python Packaging Authority, nearly official.

Because it's a newcomer, of course, it works with `pyproject.toml` spec, the PEP six-hundred twenty-one style.  
But, I think configurable is nearly equal to complex. You will need to read and understand the documentation carefully to use it.

And also, it does not include a dependency updater and lock-file.
-->

---
layout: section
---

# pip

## <https://pip.pypa.io/en/stable/index.html>

<!--
Thanks for listening, but **PLEASE DO NOT LEAVE!** Now the last tool is pip.  
It maybe no need to explain, but I'll introduce it briefly.
-->

---

# pip: Pros

- (Almost) Build-in in Python, very simple
- Works with `pyproject.toml` spec, [PEP 621](https://peps.python.org/pep-0621/) style

# pip: Cons

- Without wraps virtualenv
- Not supporting file-managed dependency
- Not included task-runner and wheel builder

<!--
Goes without saying. I don't know any Pythonistas who haven't used this. Since `ensurepip` module is built-in in Python, so you can use pip as built-in in tool.  
By the way, I'm newcomer Since I started using Python in 2018, I don't know the old days when pip was not built-in. Haha...  

Since it is maintained by PyPA, `pyproject.toml` based on PEP six-hundred twenty-one is also supported.
Please note that **pip is not a packaging tool, just a package installer** wraps setuptools.

I'm sure you all know the cons too, it does not wrap virtualenv, does not support file-managed dependency, and does not include task-runner and wheel builder.  
If you want to use a task-runner like npm-task, you might write Makefile...  
And if you want to build your wheels, you might use `twine` or `build`, maybe it is lazy.
-->

---
layout: section
---

# SUMMARY

## What is the best tool? (In some use cases)

<!--
**Now finally, what you've all been waiting for, I'll introduce the best tool for each use case.**
-->

---

# Case 1: Library Developing

-> **Hatch** (with pip-tools): Very configurable and flexible

## Reasons

- Almost what you need is included
    - ex: Task-runner, wheel builder and publisher
- Maintained actively by [PyPA](https://www.pypa.io)
- Works with `pyproject.toml` spec, [PEP 621](https://peps.python.org/pep-0621/) style

<!--
First. If you are a library developer, **I recommend Hatch.**

I'll recommend to use this with pip-tools, managing dependencies.  
But you should understand the pip and back-end you choose, but you will be able to do most of what you want to do.

It's maintained actively by PyPA, so I think it's a good idea to use it for work or other projects.  
And surely, it works with `pyproject.toml` spec, the PEP six-hundred twenty-one style.
-->

---

# Case 2: Application Developing

-> **PDM**: All-in-one tool and easy to use

## Reasons

- Fast dependency resolver
- Support [PEP 621](https://peps.python.org/pep-0621/) style `pyproject.toml`
- Included Task-runner (`pdm run`)

<!--
Second. If you are an application developer, **I recommend PDM.**  

I think it's needed everything is included and easy to use.  
It will be especially value-able if you are developing a large project or many people with different Python skill are involved in the project.  
It's very easy to use, and you can use it with `pyproject.toml` spec, the PEP six-hundred twenty-one style.  
And it has a task-runner, so you can use it like npm/nodejs task-scripts.   
There are few knowledge and examples, but I think it's worth a try.
-->

---

# Case 3: Automation Script Developing

-> **pip**: Simply to use, Non-dependency (built-in in Python)

## Reasons

- Lightweight, Non-dependency to install itself
- Simple to use, There are many know-hows and examples

<!--
Third. If you are an automation script developer, **I recommend just using pip.**  
The first two are suitable for large projects or libraries that also manage their versions, but many features are not needed for small projects.  
I think it's better to use pip for small projects, because it's lightweight and non-dependency to install itself.

It is not too late to switch to PDM, Poetry, or other tool when you feel that it is becoming too complex.
-->

---

# CONCLUSION

- Library Developer: **Hatch** (with pip-tools)
    - Very configurable and flexible
- Application Developer: **PDM**
    - All-in-one tool and easy to use
- Automation / Scripting Developer: **pip**
    - Simply to use, Non-dependency (built-in in Python)

<!--
Okay, let's summarize the best tool for each use case.

If you are a library developer, I recommend Hatch with pip-tools, because it is very configurable and flexible.  
Next, if you are an application developer, I recommend PDM, because it is an all-in-one tool and easy to use.  
And finally if you are an automation or scripting developer, I recommend just using pip, because it is simply to use and non-dependency to install itself.
-->

---
layout: section
---

<div class="box">
<div class="inner">

# Appendix: Rye

## <https://rye-up.com>

</div>
<img class="rye" src="https://rye-up.com/static/logo.svg" />
</div>

<!--
This is an extra section  
I can't help but take up the Rye that has emerged in the last half year. I'll give you a summary of my opinion.  
It's written by Armin Ronacher known as Mitsuhiko, who is famous for author of Flask, Jinja2, Click, and more.
-->

---

# Rye: Pros

- **Single-binary**, easy to install and use
- Works with `pyproject.toml` spec, [PEP 621](https://peps.python.org/pep-0621/) style
- Almost what you want is included; 
    - virtualenv wrapper, Package Builder, Publisher and Python version manager

<!--
Now let's compare the pros and cons of the same.  
The biggest advantage is that it is single-binary so easy to install and use.  
Surely it supports PEP six-hundred twenty-one style `pyproject.toml` spec and wraps virtualenv, including package builder and publisher.  
And, it includes a Python version manager, so you can install and switch Python versions easily like pyenv.  
-->

---

# Rye: Cons

- **EXPERIMENTAL**, not stable
    - Too early to use in production
- Mitsuhiko's personally project
- Just a wrapper of pip-tools? 
    - for the dependency manager

<!--
Needless to say, it's very experimental and his personally project, equals not stable.
It's too early to use in production, so I think it's not yet ready to be used with co-workers, especially at work.  

And, I felt it's just a wrapper of pip-tools?, as a dependency manager. If you know the its implementation, please tell me after this... haha
-->

---
layout: refs
---

# Notes: References URLs

- [PEP 517 – A build-system independent format for source trees](https://peps.python.org/pep-0517/)
- [PEP 621 – Storing project metadata in pyproject.toml](https://peps.python.org/pep-0621/)
- [PEP 660 – Editable installs for pyproject.toml based builds (wheel based)](https://peps.python.org/pep-0660/)
- [Official Doc for the setuptools by PyPA](https://setuptools.pypa.io/en/latest/index.html)
- [python-poetry/poetry: Use the \[project\] section in pyproject.toml according to PEP-621 `#3332`](https://github.com/python-poetry/poetry/issues/3332)
- [python-poetry/poetry: Add support for pyproject.toml files when adding --editable projects … `#7670`](https://github.com/python-poetry/poetry/pull/7670)
- My Blog article (in Japanese):
    - [Isn't venv + pip good for Python package management? in 2023/1](https://zenn.dev/peacock0803sz/articles/python-packaging-2023-01)
    - [Are you using the -c/--constraint option of pip install?](https://zenn.dev/peacock0803sz/articles/acd723d5a5fa0b)


---
layout: pyconapac2023
---

<div class="box">
<div class="inner">

# Thank You PyCon Community!

</div>
<img src="/images/long_light.svg" />
</div>

<!--
Thank you for listening so much. That's all for my talk.  
Finally, I'd like to say thank you to all of the PyCon APAC participants, speakers, sponsors, and volunteers.  
I hope you have a great time at PyCon APAC 2023!
-->

---
layout: thanks
---

<div class="box">
<img src="/images/qrcode.svg" />

# Questions?

## Hashtag: `#pyconapac_2`

</div>

<!--
I'll be in open space after this, so please feel free to ask me any questions or discussions.
-->