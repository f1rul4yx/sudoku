/*
 * sudoku.js - Generador y solucionador de sudokus.
 * Módulo UMD: funciona tanto en Node (require) como en el navegador (window.SudokuLib).
 *
 * Los tableros se representan como strings de 81 caracteres ('0' = vacío)
 * y también como matrices 9x9 para los algoritmos.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        root.SudokuLib = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var DIFFICULTIES = {
        facil:   { label: 'Fácil',   minEmpty: 32, maxEmpty: 36 },
        medio:   { label: 'Medio',   minEmpty: 38, maxEmpty: 42 },
        dificil: { label: 'Difícil', minEmpty: 45, maxEmpty: 49 },
        experto: { label: 'Experto', minEmpty: 52, maxEmpty: 56 }
    };

    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
    }

    function numbers() {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    }

    function emptyBoard() {
        var board = [];
        for (var i = 0; i < 9; i++) {
            board.push([0, 0, 0, 0, 0, 0, 0, 0, 0]);
        }
        return board;
    }

    // Matriz 9x9 a string de 81 caracteres
    function boardToStr(board) {
        var out = '';
        for (var r = 0; r < 9; r++) {
            for (var c = 0; c < 9; c++) {
                out += String(board[r][c]);
            }
        }
        return out;
    }

    // String de 81 caracteres a matriz 9x9
    function strToBoard(str) {
        var board = [];
        for (var r = 0; r < 9; r++) {
            var row = [];
            for (var c = 0; c < 9; c++) {
                var ch = str.charAt(r * 9 + c);
                row.push(ch >= '1' && ch <= '9' ? parseInt(ch, 10) : 0);
            }
            board.push(row);
        }
        return board;
    }

    function isPlacementValid(board, row, col, num) {
        for (var i = 0; i < 9; i++) {
            if (board[row][i] === num && i !== col) return false;
            if (board[i][col] === num && i !== row) return false;
        }
        var br = Math.floor(row / 3) * 3;
        var bc = Math.floor(col / 3) * 3;
        for (var r = br; r < br + 3; r++) {
            for (var c = bc; c < bc + 3; c++) {
                if (board[r][c] === num && (r !== row || c !== col)) return false;
            }
        }
        return true;
    }

    function solveRecursive(board) {
        for (var r = 0; r < 9; r++) {
            for (var c = 0; c < 9; c++) {
                if (board[r][c] === 0) {
                    var candidates = shuffle(numbers());
                    for (var k = 0; k < candidates.length; k++) {
                        var n = candidates[k];
                        if (isPlacementValid(board, r, c, n)) {
                            board[r][c] = n;
                            if (solveRecursive(board)) return true;
                            board[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    // Resuelve un tablero (matriz). Devuelve la solución o null.
    function solveBoard(board) {
        var copy = board.map(function (row) { return row.slice(); });
        return solveRecursive(copy) ? copy : null;
    }

    // Cuenta soluciones de un tablero hasta un límite (para comprobar unicidad).
    function countSolutions(board, limit) {
        limit = limit || 2;
        var count = 0;
        var g = board.map(function (row) { return row.slice(); });

        function rec() {
            if (count >= limit) return;
            for (var r = 0; r < 9; r++) {
                for (var c = 0; c < 9; c++) {
                    if (g[r][c] === 0) {
                        for (var n = 1; n <= 9; n++) {
                            if (isPlacementValid(g, r, c, n)) {
                                g[r][c] = n;
                                rec();
                                if (count >= limit) return;
                                g[r][c] = 0;
                            }
                        }
                        return;
                    }
                }
            }
            count++;
        }

        rec();
        return count;
    }

    // Genera un sudoku completo y oculto con solución única conforme a la dificultad.
    // Devuelve { puzzle, solution } como strings de 81 caracteres.
    function generate(difficulty) {
        var conf = DIFFICULTIES[difficulty] || DIFFICULTIES.facil;
        var targetEmpty = conf.minEmpty +
            Math.floor(Math.random() * (conf.maxEmpty - conf.minEmpty + 1));

        var full = emptyBoard();
        solveRecursive(full); // genera una solución completa aleatoria

        var puzzle = full.map(function (row) { return row.slice(); });

        var order = [];
        for (var r = 0; r < 9; r++) {
            for (var c = 0; c < 9; c++) {
                order.push(r * 9 + c);
            }
        }
        order = shuffle(order);

        var removed = 0;
        for (var i = 0; i < order.length && removed < targetEmpty; i++) {
            var idx = order[i];
            var rr = Math.floor(idx / 9);
            var cc = idx % 9;
            var backup = puzzle[rr][cc];
            puzzle[rr][cc] = 0;
            if (countSolutions(puzzle, 2) === 1) {
                removed++;
            } else {
                puzzle[rr][cc] = backup;
            }
        }

        return {
            puzzle: boardToStr(puzzle),
            solution: boardToStr(full)
        };
    }

    // Comprueba si el valor de la celda idx (0-80) es válido en el string dado.
    function hasConflict(str, idx) {
        var ch = str.charAt(idx);
        if (ch === '0') return false;
        var num = parseInt(ch, 10);
        var row = Math.floor(idx / 9);
        var col = idx % 9;

        for (var c = 0; c < 9; c++) {
            var other = idx - (idx % 9) + c;
            if (other !== idx && parseInt(str.charAt(other), 10) === num) return true;
        }
        for (var r = 0; r < 9; r++) {
            var other2 = r * 9 + col;
            if (other2 !== idx && parseInt(str.charAt(other2), 10) === num) return true;
        }
        var br = Math.floor(row / 3) * 3;
        var bc = Math.floor(col / 3) * 3;
        for (var rr = br; rr < br + 3; rr++) {
            for (var cc = bc; cc < bc + 3; cc++) {
                var other3 = rr * 9 + cc;
                if (other3 !== idx && parseInt(str.charAt(other3), 10) === num) return true;
            }
        }
        return false;
    }

    function isStringValid(str) {
        if (!str || str.length !== 81) return false;
        for (var i = 0; i < 81; i++) {
            if (hasConflict(str, i)) return false;
        }
        return true;
    }

    function isComplete(str) {
        if (!str || str.length !== 81) return false;
        for (var i = 0; i < 81; i++) {
            if (str.charAt(i) === '0') return false;
        }
        return isStringValid(str);
    }

    return {
        DIFFICULTIES: DIFFICULTIES,
        generate: generate,
        solve: solveBoard,
        countSolutions: countSolutions,
        boardToStr: boardToStr,
        strToBoard: strToBoard,
        hasConflict: hasConflict,
        isStringValid: isStringValid,
        isComplete: isComplete
    };
});