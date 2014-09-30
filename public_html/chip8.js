function Chip8(canvas) {
	this.canvas = canvas;
	this.keyMapping = {
		   49:1,50:2,51:3,52:0xc,81:4,87:5,69:6,82:0xd,65:7,83:8,68:9,70:0xe,90:0xa,88:0,67:0xb,86:0xf
	};
	this.reset();
	this.lastTimestamp = NaN;
}

Chip8.prototype.reset = function(code) {
	this.memory = [0xF0,0x90,0x90,0x90,0xF0, 0x20,0x60,0x20,0x20,0x70, 0xF0,0x10,0xF0,0x80,0xF0, 0xF0,0x10,0xF0,0x10,0xF0, 0x90,0x90,0xF0,0x10,0x10
, 0xF0,0x80,0xF0,0x10,0xF0 ,0xF0,0x80,0xF0,0x90,0xF0 ,0xF0,0x10,0x20,0x40,0x40 ,0xF0,0x90,0xF0,0x90,0xF0 ,0xF0,0x90,0xF0,0x10,0xF0 ,0xF0,0x90,0xF0,0x90,0x90 ,0xE0,0x90,0xE0,0x90,0xE0 ,0xF0,0x80,0x80,0x80,0xF0 ,0xE0,0x90,0x90,0x90,0xE0 ,0xF0,0x80,0xF0,0x80,0xF0 ,0xF0,0x80,0xF0,0x80,0x80];
	this.memory.length = 4096;
	this.display = new Array(2048);
	this.PC = 0x200;
	this.V = Array.apply(null, new Array(16)).map(Number.prototype.valueOf,0);
	this.I = 0;
	this.stack = [];
	this.delayTimer = 0;
	this.soundTimer = 0;
	this.keyPressed = new Array(9);
	this.waitForKey = false;
	this.writeKeyToRegister = 0;
};

Chip8.prototype.drawToMemory = function(x,y,sourceAddress, length) {
	//console.log(x + ":" + y + ":" + sourceAddress + ":" + length)
	this.V[0xF] = 0;
	for (var i=0;i<length;i++) {
		for (var j=0;j<8;j++) {
			var k = ((x+j)%64)+((((y+i)%32)*64));
			var n = this.display[k] ^ ((this.memory[sourceAddress+i] >>> (7-j)) & 0x1); 
			if (this.V[0xF] || (this.display[k] && !n)) this.V[0xF] = 1;
			this.display[k] = n;
		}
	}
};

Chip8.prototype.drawToCanvas = function() {
	context = this.canvas.getContext("2d");
	context.clearRect(0,0,640,320); 
	for (var x=0;x<64;x++) { 
		for (var y=0;y<32;y++) {
			var pixelSet = this.display[x+(y*64)];
			if (pixelSet) {
				var cx = x*10, cy = y*10;
				context.fillRect(cx,cy, 10, 10);
			}
		}
	}
};

Chip8.prototype.mainLoop = function() {
	if (this.waitForKey) {
		return;
	}
	
	var opcode = this.memory[this.PC] << 8 | this.memory[this.PC + 1];
//	console.log((opcode >>> 8).toString(16) + " " + (opcode & 0x00FF).toString(16));
//	console.log("[PC="+this.PC.toString(16)+ "  I="+this.I.toString(16)+ "  V2="+this.V[2].toString(16)+"]");

	outer:
	switch (opcode & 0xF000) {
		case 0x0000: 
			switch (opcode & 0x0FFF) {
				case 0x0E0: //CLS
							this.display = new Array(2048);
							if (this.DEBUG) {
								console.log("CLS");
							}
							break outer;
				case 0x0EE: //RET
							this.PC = this.stack.pop();
							if (this.DEBUG) {
								console.log("RET");
							}
							break outer;
			}
			break;
		case 0x1000: // JP
			this.PC = (opcode & 0x0FFF) -2;
			if (this.DEBUG) {
				console.log( "JP #"+ (opcode & 0x0FFF).toString(16) );
			}
			break;
		case 0x2000: // CALL
			this.stack.push(this.PC);
			this.PC = (opcode & 0x0FFF) -2;
			if (this.DEBUG) {
				console.log("CALL "+(opcode & 0x0FFF).toString(16));
			}
			break;
		case 0x3000: // SE Vx, byte
			var x = (opcode >> 8) & 0x0F;
			var kk = opcode & 0x00FF;
			if (this.V[x] === kk) this.PC += 2;
			if (this.DEBUG) {
				console.log("SE V" + x + ", #"+kk.toString(16));
				console.log(this.V[x] === kk);
			}
			break;
		case 0x4000: // SNE Vx, byte
			var x = (opcode >> 8) & 0x0F;
			var kk = opcode & 0x00FF;
			if (this.V[x] !== kk) this.PC += 2;
			if (this.DEBUG) {
				console.log("SNE V" + x + ", #"+kk.toString(16));
				console.log(this.V[x] !== kk);
			}
			break;
		case 0x5000: // SE Vx, Vy
			var x = (opcode >> 8) & 0x0F;
			var y = (opcode >> 4) & 0x0F;
			if (this.V[x] === this.V[y]) this.PC += 2;
			if (this.DEBUG) {
				console.log("SE V" + x + ", V"+y);
				console.log(this.V[x] === this.V[y]);
			}
			break;
		case 0x6000: // LD Vx, byte
			var x = (opcode >> 8) & 0x0F;
			var kk = opcode & 0x00FF;
			this.V[x] = kk;
			if (this.DEBUG) {
				console.log("LD V" + x + ", #"+kk.toString(16));
			}
			break;
		case 0x7000: // ADD Vx, byte
			var x = (opcode >> 8) & 0x0F;
			var kk = opcode & 0x00FF;
			this.V[x] = (this.V[x] + kk) & 0xFF;
			if (this.DEBUG) {
				console.log("ADD V"+x+", #"+kk.toString(16));
				console.log(this.V[x]);
			}
			break;
		case 0x8000:
			var x = (opcode >> 8) & 0x0F;
			var y = (opcode >> 4) & 0x0F;
			switch (opcode & 0x000F) {
				case 0: // LD Vx, Vy
					this.V[x] = this.V[y];
					if (this.DEBUG) {
						console.log("LD V"+x+", V"+y);
						console.log(this.V[x]);
					}
					break outer;
				case 1: // OR Vx, Vy
					this.V[x] |= this.V[y];
					if (this.DEBUG) {
						console.log("OR V"+x+", V"+y);
						console.log(this.V[x]);
					}
					break outer;
				case 2: // AND Vx, Vy
					this.V[x] &= this.V[y];
					if (this.DEBUG) {
						console.log("AND V"+x+", V"+y);
						console.log(this.V[x]);
					}
					break outer;
				case 3: // XOR Vx, Vy
					this.V[x] ^= this.V[y];
					if (this.DEBUG) {
						console.log("XOR V"+x+", V"+y);
						console.log(this.V[x]);
					}
					break outer;
				case 4: // ADD Vx, Vy
					this.V[x] += this.V[y];
					this.V[0xF] = Number(this.V[x] > 0xFF);
					this.V[x] &= 0xFF;
					if (this.DEBUG) {
						console.log("ADD V"+x+", V"+y);
						console.log(this.V[x]);
						console.log(this.V[0xF]);
					}
					break outer;
				case 5: // SUB Vx, Vy
					this.V[0xF] = Number(this.V[x] > this.V[y]);
					this.V[x] -= this.V[y];
					if (this.V[x] < 0) this.V[x] = 0;
					if (this.DEBUG) {
						console.log("SUB V"+x+", V"+y);
						console.log(this.V[x]);
						console.log(this.V[0xF]);
					}
					break outer;
				case 6: // SHR Vx {, Vy}
					this.V[0xF] = this.V[x] & 0x01;
					this.V[x] >>>= 1;
					if (this.DEBUG) {
						console.log("SHR V"+x+", V"+y);
						console.log(this.V[x]);
						console.log(this.V[0xF]);
					}
					break outer;
				case 7: // SUBN Vx, Vy
					this.V[0xF] = Number(this.V[y] > this.V[x]);
					this.V[x] = this.V[y] - this.V[x];
					if (this.V[x] < 0) this.V[x] = 0;
					if (this.DEBUG) {
						console.log("SUBN V"+x+", V"+y);
						console.log(this.V[x]);
						console.log(this.V[0xF]);
					}
					break outer;
				case 0xE: // SHL Vx {, Vy}
					this.V[0xF] = Number((this.V[x] & 0x80) > 0);
					this.V[x] <<= 1;
					this.V[x] &= 0xFF;
					if (this.DEBUG) {
						console.log("SHL V"+x+", V"+y);
						console.log(this.V[x]);
						console.log(this.V[0xF]);
					}
					break outer;
			}
			break;
		case 0x9000: // SNE Vx, Vy
			var x = (opcode >> 8) & 0x0F;
			var y = (opcode >> 4) & 0x0F;
			if (this.V[x] !== this.V[y]) this.PC += 2;
			if (this.DEBUG) {
				console.log("SNE V" + x + ", V"+y);
				console.log(this.V[x] !== this.V[y]);
			}
			break;
		case 0xA000: // LD I, addr
			var n = opcode & 0x0FFF;
			this.I = n;
			if (this.DEBUG) {
				console.log("LD I, #"+n.toString(16));
			}
			break;
		case 0xB000: // JP V0, addr
			var n = opcode & 0x0FFF;
			this.PC = n + this.V[0] -2;
			if (this.DEBUG) {
				console.log("JP V0, "+n.toString(16));
				console.log(this.V[0] + n);
			}
			break;
		case 0xC000: // RND Vx, byte
			var x = (opcode >> 8) & 0x0F;
			var kk = opcode & 0x00FF;
			this.V[x] = Math.floor(Math.random() * 256) & kk;
			if (this.DEBUG) {
				console.log("RND V" + x + ", #"+kk.toString(16));
				console.log(this.V[x]);
			}
			break;
		case 0xD000: // DRW Vx, Vy, nibble
			var x = (opcode >> 8) & 0x0F;
			var y = (opcode >> 4) & 0x0F;
			var n = opcode & 0x000F; 
			this.drawToMemory(this.V[x], this.V[y],this.I, n);
			if (this.DEBUG) {
				console.log("DRW V"+x + ", V"+y+", "+n);
				console.log(this.V[x]);
				console.log(this.V[y]);
				console.log(this.memory.slice(this.I, this.I+n));
			}
			break;
		case 0xE000: //
			var l = (opcode & 0xFF);
			var x = (opcode >> 8) & 0x0F;
			switch (l) {
				case 0x9E: // SKP Vx
					if (this.keyPressed[this.V[x]]) this.PC += 2;
					break outer;
				case 0xA1: // SKNP Vx
					if (!this.keyPressed[this.V[x]]) this.PC += 2;
					break outer;
			}
			break;
		case 0xF000: 
			var l = (opcode & 0xFF);
			var x = (opcode >> 8) & 0x0F;
			switch (l) {
				case 0x07: // LD Vx, DT
					this.V[x] = this.delayTimer;
					break outer;
				case 0x0A: // LD Vx, K
					this.writeKeyToRegister = x;
					this.waitForKey = true;
					break outer;
				case 0x15: // LD DT, Vx
					this.delayTimer = this.V[x];
					break outer;
				case 0x18: // LD ST, Vx
					this.soundTimer = this.V[x];
					break outer;
				case 0x1E: // ADD I, Vx
					this.I = ( this.I + this.V[x] );
					this.V[0xF] = Number(this.I > 0xFFFF);
					this.I &= 0xFFFF;
					if (this.DEBUG) {
						console.log("ADD I, V"+x);
						console.log(this.I);
					}
					break outer;
				case 0x29: // LD F, Vx
					this.I = this.V[x] * 5;
					if (this.DEBUG) {
						console.log("LD F, V"+x);
						console.log(this.I);
					}
					break outer;
				case 0x33: // LD B, Vx
					var hundreds = Math.floor(this.V[x] / 100);
					var remainder = this.V[x] % 100;
					var tens = Math.floor(remainder / 10);
					remainder = remainder % 10;
					this.memory[this.I] = hundreds;
					this.memory[this.I+1] = tens;
					this.memory[this.I+2] = remainder;
					break outer;
				case 0x55: //  LD [I], Vx
					for (var i=0;i<=x;i++) {
						this.memory[this.I + i] = this.V[i];	
					}
					if (this.DEBUG) {
						console.log("LD ["+this.I+"], V" + x);
						console.log(this.memory.slice(this.I,this.I+i));
						console.log(this.V);
					}
					break outer;
				case 0x65: //  LD Vx, [I]
					for (var i=0;i<=x;i++) {
						this.V[i] =	this.memory[this.I + i];
					}
					if (this.DEBUG) {
						console.log("LD V" + x +", ["+this.I+"]");
						console.log(this.V);
						console.log(this.memory.slice(this.I,this.I+i));
					}
					break outer;
			}
			break;
	}
	this.PC += 2;
	if (this.delayTimer) this.delayTimer--;
	if (this.soundTimer) this.soundTimer--;
	this.drawToCanvas();	
};

Chip8.prototype.recurseLoop = function(timestamp) {
	if (isNaN(this.lastTimestamp)) {
		this.lastTimestamp = timestamp;
	}
	if ((timestamp - this.lastTimestamp) > 30) {
		this.mainLoop();
		this.lastTimestamp = timestamp;
	}

	var self = this;
	requestAnimationFrame(function(ts){self.recurseLoop(ts);});
};


// this needs to be bound to keydown event 
Chip8.prototype.getKeyDownListener = function() {
	var chip = this;

	return function(event) {
		chip.keyPressed[chip.keyMapping[event.keyCode]] = true;	
		console.log("keydown" + chip.keyMapping[event.keyCode]);
		
		if (chip.waitForKey) {
			chip.V[chip.writeKeyToRegister] = chip.keyMapping[event.keyCode];
			chip.waitForKey = false;
		}
	};
};

// this needs to be bound to keyup event
Chip8.prototype.getKeyUpListener = function() {
	var chip = this;

	return function(event) {
		console.log("keydown" + chip.keyMapping[event.keyCode]);
		chip.keyPressed[chip.keyMapping[event.keyCode]] = false;	
	};
};

Chip8.prototype.load = function(code) {
	this.PC = 0x200;
	for (var i=0;i<code.length;i++) {
		this.memory[this.PC + i] = code[i];
	}
};

Chip8.prototype.run = function(code) {
	this.recurseLoop();
};

