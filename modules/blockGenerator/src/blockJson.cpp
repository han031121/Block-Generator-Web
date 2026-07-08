#include "blockJson.hpp"

#include <fstream>
#include <ostream>
#include <stdexcept>

namespace
{
json optionsToJson(const GeneratorOptions& options)
{
	return {
		{"generate_count", options.generate_count},
		{"block_count_min", options.block_count_min},
		{"block_count_max", options.block_count_max},
		{"max_r", options.max_r},
		{"max_c", options.max_c},
		{"max_h", options.max_h},
		{"density", options.density},
		{"allow_duplicate", options.allow_duplicate}
	};
}

void validateOptions(const GeneratorOptions& options)
{
	if (options.generate_count < 0)
		throw std::runtime_error("generate_count must be 0 or greater.");
	if (options.max_r < 1 || options.max_c < 1 || options.max_h < 1)
		throw std::runtime_error("max_r, max_c, and max_h must be 1 or greater.");
	if (options.max_r > MAX_SIZE || options.max_c > MAX_SIZE || options.max_h > MAX_SIZE)
		throw std::runtime_error("max_r, max_c, and max_h must not exceed MAX_SIZE.");
}

std::string makeIndent(int depth)
{
	return std::string(depth * 4, ' ');
}

void writeCompactArray(std::ostream& output, const json& data)
{
	output << '[';
	for (json::size_type i = 0; i < data.size(); ++i)
	{
		if (i > 0)
			output << ", ";
		output << data[i].dump();
	}
	output << ']';
}

void writeHeightData(std::ostream& output, const json& data, int depth)
{
	if (data.empty())
	{
		output << "[]";
		return;
	}

	output << "[\n";
	for (json::size_type i = 0; i < data.size(); ++i)
	{
		output << makeIndent(depth + 1);
		writeCompactArray(output, data[i]);
		if (i + 1 < data.size())
			output << ',';
		output << '\n';
	}
	output << makeIndent(depth) << ']';
}

void writeJsonValue(std::ostream& output, const json& data, int depth)
{
	if (data.is_object())
	{
		if (data.empty())
		{
			output << "{}";
			return;
		}

		output << "{\n";
		json::size_type index = 0;
		for (const auto& item : data.items())
		{
			output << makeIndent(depth + 1) << json(item.key()).dump() << ": ";
			if (item.key() == "height_data")
				writeHeightData(output, item.value(), depth + 1);
			else
				writeJsonValue(output, item.value(), depth + 1);

			if (++index < data.size())
				output << ',';
			output << '\n';
		}
		output << makeIndent(depth) << '}';
		return;
	}

	if (data.is_array())
	{
		if (data.empty())
		{
			output << "[]";
			return;
		}

		output << "[\n";
		for (json::size_type i = 0; i < data.size(); ++i)
		{
			output << makeIndent(depth + 1);
			writeJsonValue(output, data[i], depth + 1);
			if (i + 1 < data.size())
				output << ',';
			output << '\n';
		}
		output << makeIndent(depth) << ']';
		return;
	}

	output << data.dump();
}
}

GeneratorOptions generatorOptionsFromJson(const json& data)
{
    GeneratorOptions options{
        data.at("generate_count").get<int>(),
        data.at("block_count_min").get<int>(),
        data.at("block_count_max").get<int>(),
        data.at("max_r").get<int>(),
        data.at("max_c").get<int>(),
        data.at("max_h").get<int>(),
        data.at("density").get<double>(),
        data.at("allow_duplicate").get<bool>()
    };

    validateOptions(options);
    return options;
}

GeneratorOptions readGeneratorOptions(const std::string& input_path)
{
    std::ifstream input(input_path);
    if (!input)
        throw std::runtime_error("Cannot open input json file: " + input_path);

    json data;
    input >> data;
    return generatorOptionsFromJson(data);
}

json blockToJson(const blockData& block_data, int index)
{
	json height_data = json::array();
	for (int r = 0; r < block_data.getMaxRow(); ++r)
	{
		json row = json::array();
		for (int c = 0; c < block_data.getMaxCol(); ++c)
			row.push_back(block_data.getHeightData(r, c));
		height_data.push_back(row);
	}

	json block = {
		{"index", index},
		{"generated", block_data.isGenerated()},
		{"block_count", block_data.getBlockCount()},
		{"size", {
			{"r", block_data.getSizeRow()},
			{"c", block_data.getSizeCol()},
			{"h", block_data.getSizeHeight()}
		}},
		{"height_data", height_data}
	};

	if (block_data.isGenerated())
	{
		auto center = block_data.getCenter();
		block["identify"] = block_data.getIdentify();
		block["center"] = {
			{"r", std::get<0>(center)},
			{"c", std::get<1>(center)},
			{"h", std::get<2>(center)}
		};
	}
	else
	{
		block["identify"] = nullptr;
		block["center"] = nullptr;
	}

	return block;
}

json generateBlocksToJson(const GeneratorOptions& options)
{
	blockData block_data(
		options.block_count_min,
		options.block_count_max,
		options.max_r,
		options.max_c,
		options.max_h,
		options.density,
		options.allow_duplicate
	);

	json blocks = json::array();
	for (int i = 0; i < options.generate_count; ++i)
	{
		block_data.generateBlock();
		blocks.push_back(blockToJson(block_data, i));
	}

	return {
		{"input", optionsToJson(options)},
		{"blocks", blocks}
	};
}

json generateBlocksFromJsonText(const std::string& input_json_text)
{
    json input = json::parse(input_json_text);
    GeneratorOptions options = generatorOptionsFromJson(input);

    return generateBlocksToJson(options);
}

void writeJsonFile(const std::string& output_path, const json& data)
{
	std::ofstream output(output_path);
	if (!output)
		throw std::runtime_error("Cannot open output json file: " + output_path);

	writeJsonValue(output, data, 0);
	output << '\n';
}
