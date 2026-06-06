#include "blockData.hpp"

#include <memory>

int main()
{
	// read json, set block data
	int gen_count;
	int bc1, bc2, maxr, maxc, maxh;
	double den;
	bool dup;

	std::cout << "generate count : ";
	std::cin >> gen_count;
	std::cout << "block count 1 : ";
	std::cin >> bc1;
	std::cout << "block count 2 : ";
	std::cin >> bc2;
	std::cout << "max_r : ";
	std::cin >> maxr;
	std::cout << "max_c : ";
	std::cin >> maxc;
	std::cout << "max_h : ";
	std::cin >> maxh;
	std::cout << "density : ";
	std::cin >> den;
	std::cout << "allow duplicatate : ";
	std::cin >> dup;

	std::unique_ptr<blockData> block_data(new blockData(bc1, bc2, maxr, maxc, maxh, den, dup));

	// print block data
	std::cout << "hello." << std::endl;

	while(1) {
		bool input;
		std::cout << "generate : ";
		std::cin >> input;

		if(!input)
			break;
		
		block_data->generateBlock();
		block_data->printBlockData();
	}

	return 0;
}