// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PD
{
        struct Product
        {
            uint256 product_id;
            string product_name;
            string product_mnf_date;
            string product_batch;
            string product_hash;
        }

        mapping(uint256 => Product) public product;


        function addData(uint256 p_id, string memory p_name, string memory p_m_date, string memory p_batch, string memory p_hash) public 
        {
            product[p_id] = Product(p_id, p_name, p_m_date, p_batch, p_hash);

        }

        function getData(uint256 p_id) public view returns(uint256, string memory, string memory, string memory, string memory)
        {
            Product memory pdt = product[p_id];
            return (pdt.product_id, pdt.product_name, pdt.product_mnf_date, pdt.product_batch, pdt.product_hash);
        }



}