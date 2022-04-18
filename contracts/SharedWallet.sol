// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

contract Allowance {
    address public owner;

    mapping(address => uint) public allowance;

    event AllowanceChanged(address indexed _forWho, address indexed _FromWhom, uint _oldAmount, uint _newAmount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "You are not the owner");
        _;
    }

    modifier Permitted(uint _amount) {
        require(msg.sender == owner || allowance[msg.sender] >= _amount, "You are not allowed");
        _;
    }

    function setAllowance(address _who, uint _amount) public onlyOwner {
        emit AllowanceChanged(_who, msg.sender, allowance[_who], allowance[_who] + _amount);
        allowance[_who] += _amount;
    }

    function reduceAllowance(address _who, uint _amount) internal {
        emit AllowanceChanged(_who, msg.sender, allowance[_who], allowance[_who] - _amount);
        allowance[_who] -= _amount;
    }
}

contract SharedWallet is Allowance {
    event MoneySent(address indexed _beneficiary, uint _amount);
    event MoneyReceived(address indexed _from, uint _amount);

    function withdrawMoney(address _to, uint _amount) public Permitted(_amount) {
        require(_amount <= address(this).balance, "Exceeds the total contract balance");
        if(msg.sender != owner) {
            reduceAllowance(msg.sender, _amount);
        }
        emit MoneySent(_to, _amount);

        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Failed to withdraw money");
    }

    receive () external payable {
        emit MoneyReceived(msg.sender, msg.value);
    }
}